const TRIPO_V3_BASE = "https://openapi.tripo3d.ai/v3";

export class TripoApiError extends Error {
  public readonly statusCode: number;
  public readonly tripoCode?: number;
  public readonly userActionableMessage: string;

  constructor(
    message: string,
    statusCode: number,
    userActionableMessage: string,
    tripoCode?: number
  ) {
    super(message);
    this.name = "TripoApiError";
    this.statusCode = statusCode;
    this.tripoCode = tripoCode;
    this.userActionableMessage = userActionableMessage;
  }
}

function mapTripoError(
  httpStatus: number,
  code?: number,
  apiMessage?: string
): TripoApiError {
  if (httpStatus === 401 || httpStatus === 403 || code === 2001 || code === 1004) {
    return new TripoApiError(
      apiMessage || "Unauthorized Tripo API key",
      401,
      "Your Tripo AI API key was rejected. Verify that it starts with 'tsk_' and is active in the Tripo Developer Console.",
      code
    );
  }
  if (code === 2010 || httpStatus === 402) {
    return new TripoApiError(
      apiMessage || "Insufficient Tripo credits",
      402,
      "Your Tripo AI account has insufficient credits to generate this 3D model. Top up your wallet at platform.tripo3d.ai and retry.",
      code
    );
  }
  if (httpStatus === 429 || code === 2008) {
    return new TripoApiError(
      apiMessage || "Tripo rate limit or concurrency limit reached",
      429,
      "Tripo AI rate or concurrent task limit reached. Wait a moment for active 3D tasks to finish and try again.",
      code
    );
  }
  return new TripoApiError(
    apiMessage || `Tripo API HTTP ${httpStatus}`,
    httpStatus >= 400 ? httpStatus : 502,
    apiMessage
      ? `Tripo AI returned an error: ${apiMessage}`
      : "Tripo AI encountered an unexpected generation error. Please retry.",
    code
  );
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
  timeoutMs = 35000
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 502) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  throw new TripoApiError(
    lastErr instanceof Error ? lastErr.message : "Network timeout contacting Tripo AI",
    504,
    "Network request to Tripo AI timed out. Please verify internet connectivity and try again."
  );
}

export async function validateTripoApiKey(apiKey: string): Promise<{
  balance: number;
  frozen: number;
}> {
  const cleaned = apiKey.trim();
  if (!cleaned) {
    throw new TripoApiError(
      "Missing Tripo API key",
      400,
      "Please enter a valid Tripo AI API key."
    );
  }

  const res = await fetchWithRetry(`${TRIPO_V3_BASE}/account/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cleaned}`,
    },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.code !== 0) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  return {
    balance: Number.parseFloat(String(payload.data?.balance ?? 0)),
    frozen: Number.parseFloat(String(payload.data?.frozen ?? 0)),
  };
}

export async function uploadImageToTripo(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  form.append("file", blob, filename);

  const res = await fetchWithRetry(
    `${TRIPO_V3_BASE}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: form,
    },
    2,
    45000
  );

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.code !== 0 || !payload.data?.file_token) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  return payload.data.file_token as string;
}

export async function createTripoMultiviewTask(
  apiKey: string,
  fileToken: string
): Promise<string> {
  const res = await fetchWithRetry(`${TRIPO_V3_BASE}/generation/image-to-multiview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      input: fileToken,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.code !== 0 || !payload.data?.task_id) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  return payload.data.task_id as string;
}

export async function createTripoImageToModelTask(
  apiKey: string,
  fileToken: string,
  options?: {
    model?: string;
    faceLimit?: number;
    enableImageAutofix?: boolean;
    textureAlignment?: "original_image" | "geometry";
    textureQuality?: "standard" | "detailed";
    orientation?: "align_image" | "default";
  }
): Promise<string> {
  const modelVersion = options?.model ?? "v3.1-20260211";
  const faceLimit = options?.faceLimit ?? 40000;
  // CRITICAL: Default enable_image_autofix to false so Tripo v3 NEVER rewrites or mutates
  // our archaeologically restored image prior to 3D mesh & UV texture synthesis.
  const enableAutofix = options?.enableImageAutofix ?? false;

  const strictBody: Record<string, unknown> = {
    input: fileToken,
    model: modelVersion,
    texture: true,
    pbr: true,
    face_limit: faceLimit,
    enable_image_autofix: enableAutofix,
    texture_alignment: options?.textureAlignment ?? "original_image",
    texture_quality: options?.textureQuality ?? "detailed",
    orientation: options?.orientation ?? "default",
  };

  let res = await fetchWithRetry(`${TRIPO_V3_BASE}/generation/image-to-model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(strictBody),
  });

  let payload = await res.json().catch(() => null);

  // Fallback without extended v3 alignment keys if rejected by a future model schema
  if (!res.ok && res.status === 400) {
    res = await fetchWithRetry(`${TRIPO_V3_BASE}/generation/image-to-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        input: fileToken,
        model: modelVersion,
        texture: true,
        pbr: true,
        face_limit: faceLimit,
        enable_image_autofix: enableAutofix,
      }),
    });
    payload = await res.json().catch(() => null);
  }

  if (!res.ok || !payload || payload.code !== 0 || !payload.data?.task_id) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  return payload.data.task_id as string;
}

export async function createTripoMultiviewToModelTask(
  apiKey: string,
  multiviewInput:
    | { taskId: string }
    | { front: string; left?: string; back?: string; right?: string },
  options?: {
    model?: string;
    faceLimit?: number;
  }
): Promise<string> {
  const inputs =
    "taskId" in multiviewInput
      ? [{ task_id: multiviewInput.taskId }]
      : [
          { front: multiviewInput.front },
          ...(multiviewInput.left ? [{ left: multiviewInput.left }] : []),
          ...(multiviewInput.back ? [{ back: multiviewInput.back }] : []),
          ...(multiviewInput.right ? [{ right: multiviewInput.right }] : []),
        ];

  const res = await fetchWithRetry(
    `${TRIPO_V3_BASE}/generation/multiview-to-model`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: options?.model ?? "v3.1-20260211",
        inputs,
        texture: true,
        pbr: true,
        texture_quality: "detailed",
        face_limit: options?.faceLimit ?? 40000,
      }),
    }
  );

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.code !== 0 || !payload.data?.task_id) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  return payload.data.task_id as string;
}

export interface TripoTaskPollResult {
  taskId: string;
  status: "queued" | "running" | "success" | "failed" | "cancelled" | "banned";
  progress: number;
  glbDownloadUrl: string | null;
  previewImageUrl: string | null;
  multiviewUrls?: {
    front?: string;
    left?: string;
    back?: string;
    right?: string;
  };
  rawOutput?: Record<string, unknown>;
}

export async function getTripoTaskStatus(
  apiKey: string,
  taskId: string
): Promise<TripoTaskPollResult> {
  const res = await fetchWithRetry(
    `${TRIPO_V3_BASE}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    }
  );

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.code !== 0 || !payload.data) {
    throw mapTripoError(res.status, payload?.code, payload?.message);
  }

  const data = payload.data;
  const out = (data.output ?? {}) as Record<string, unknown>;

  const pickString = (...keys: string[]): string | null => {
    for (const k of keys) {
      const val = out[k];
      if (typeof val === "string" && val.startsWith("http")) return val;
      if (
        val &&
        typeof val === "object" &&
        "url" in val &&
        typeof (val as { url?: unknown }).url === "string"
      ) {
        return (val as { url: string }).url;
      }
    }
    return null;
  };

  const glbDownloadUrl = pickString(
    "pbr_model",
    "model",
    "model_url",
    "base_model"
  );
  const previewImageUrl = pickString(
    "rendered_image",
    "rendered_image_url",
    "preview"
  );

  const front = pickString("front_view_url", "front");
  const left = pickString("left_view_url", "left");
  const back = pickString("back_view_url", "back");
  const right = pickString("right_view_url", "right");

  return {
    taskId: String(data.task_id ?? taskId),
    status: data.status,
    progress: typeof data.progress === "number" ? data.progress : 0,
    glbDownloadUrl,
    previewImageUrl,
    multiviewUrls:
      front || left || back || right
        ? {
            front: front ?? undefined,
            left: left ?? undefined,
            back: back ?? undefined,
            right: right ?? undefined,
          }
        : undefined,
    rawOutput: out,
  };
}

export async function downloadRemoteBinary(url: string): Promise<Buffer> {
  const res = await fetchWithRetry(url, { method: "GET" }, 2, 60000);
  if (!res.ok) {
    throw new TripoApiError(
      `Failed downloading Tripo asset (${res.status})`,
      502,
      "Generated 3D asset download failed before persistence. Please retry generation."
    );
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
