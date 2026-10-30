import sharp from "sharp";
import type { AiProvider } from "@/types/artifact";
import { AiProviderError } from "@/lib/ai/analysis-and-research";

/**
 * Step 3: Restored Artifact Image Generation
 * Conditions directly on the uploaded damaged artifact photograph so surviving proportions,
 * fractures, patterns, inscriptions, and materials are preserved while missing sections are restored.
 */
export async function generateRestoredArtifactImage(params: {
  provider: AiProvider;
  apiKey: string;
  originalImageBuffer: Buffer;
  restorationPrompt: string;
}): Promise<Buffer> {
  const { provider, apiKey, originalImageBuffer, restorationPrompt } = params;

  const fullPrompt = `${restorationPrompt}

STRICT IN-SITU ARCHAEOLOGICAL CONSERVATION LOCK (MANDATORY):
1. Treat the uploaded image as the exact surviving physical fragment of the whole ancient object. Preserve 100% of its surviving features in place: exact camera angle, facing orientation, proportions, surviving pose/drapery/iconography, brushwork or chisel marks, and authentic material grain/patina.
2. Seamlessly heal all fracture edges, crack seams, missing chips, and museum mounts so the restored artifact appears completely intact and unified as it existed in antiquity BEFORE breaking (do NOT draw artificial crack lines across the restored object).
3. Reconstruct ONLY the missing or broken portions in matching period style and material. Never convert flat 2D painted ceramic figures into 3D embossed relief, and never convert carved stone into modern plastic or human skin.
4. Do NOT introduce modern ornaments, fantasy motifs, text captions, split-screen comparisons, or museum display cases.
5. Render the single complete 3D-ready artifact centered in full view from top extremity to base, cleanly isolated on a pure transparent background with balanced diffused museum studio lighting.`;

  // Place the uploaded fragment onto a transparent 1024x1024 canvas with ample margin (780x780 inner box)
  // so missing heads, rims, handles, horns, or bases can be reconstructed around the fragment without clipping.
  const innerFragment = await sharp(originalImageBuffer)
    .resize(780, 780, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const referencePng = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: innerFragment, gravity: "center" }])
    .png()
    .toBuffer();

  const rawRestored =
    provider === "openai"
      ? await generateWithOpenAi(apiKey.trim(), referencePng, fullPrompt)
      : await generateWithGemini(apiKey.trim(), referencePng, fullPrompt);

  return normalizeRestoredOutputPng(rawRestored);
}

/**
 * Ensures consistent centered framing on a 1024x1024 PNG while preserving alpha transparency.
 */
async function normalizeRestoredOutputPng(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.hasAlpha) {
      const trimmed = await sharp(buffer).trim({ threshold: 8 }).png().toBuffer();
      const fitted = await sharp(trimmed)
        .resize(936, 936, {
          fit: "inside",
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();
      return await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: fitted, gravity: "center" }])
        .png()
        .toBuffer();
    }
    return await sharp(buffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch {
    return buffer;
  }
}

async function generateWithOpenAi(
  apiKey: string,
  referencePng: Buffer,
  prompt: string
): Promise<Buffer> {
  const attemptEdit = async (includeHighFidelity: boolean) => {
    const form = new FormData();
    form.append("model", "gpt-image-1.5");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "high");
    if (includeHighFidelity) {
      form.append("input_fidelity", "high");
    }
    form.append("background", "transparent");
    form.append("moderation", "low");
    form.append(
      "image",
      new Blob([new Uint8Array(referencePng)], { type: "image/png" }),
      "artifact.png"
    );

    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
  };

  // Primary: gpt-image-1.5 image edits endpoint with high input_fidelity & high quality
  let editRes = await attemptEdit(true);
  let editJson = await editRes.json().catch(() => null);

  if (
    !editRes.ok &&
    editRes.status === 400 &&
    String(editJson?.error?.message ?? "").includes("input_fidelity")
  ) {
    editRes = await attemptEdit(false);
    editJson = await editRes.json().catch(() => null);
  }

  if (editRes.ok && editJson?.data?.[0]?.b64_json) {
    return Buffer.from(editJson.data[0].b64_json, "base64");
  }

  const errMessage: string = editJson?.error?.message ?? "";
  if (editRes.status === 401) {
    throw new AiProviderError(
      errMessage || "Invalid OpenAI key",
      401,
      "OpenAI rejected your API key during image restoration."
    );
  }

  // Fallback: Enrich prompt with GPT-4o vision description + gpt-image-1.5 generations
  let conditionedPrompt = prompt;
  try {
    const b64Ref = referencePng.toString("base64");
    const visRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${b64Ref}` },
              },
              {
                type: "text",
                text: `Describe in 140 words a single museum studio photograph of this exact artifact restored to its intact state per this conservation brief:\n${prompt}\nSpecify its exact observed colors, proportions, surviving decoration/inscriptions, and natural material texture on a solid dark neutral studio backdrop (#1c2426) with no text, split screen, or stand.`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const visJson = await visRes.json().catch(() => null);
    if (visRes.ok && visJson?.choices?.[0]?.message?.content) {
      conditionedPrompt = visJson.choices[0].message.content.trim();
    }
  } catch {
    // Use base prompt if vision conditioning times out
  }

  const genRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt: conditionedPrompt,
      size: "1024x1024",
      quality: "high",
      background: "transparent",
      moderation: "low",
    }),
    signal: AbortSignal.timeout(110000),
  });

  const genJson = await genRes.json().catch(() => null);
  if (!genRes.ok || !genJson?.data?.[0]?.b64_json) {
    const msg =
      genJson?.error?.message ||
      errMessage ||
      `OpenAI image generation failed (${genRes.status})`;
    throw new AiProviderError(
      msg,
      genRes.status >= 400 ? genRes.status : 502,
      `OpenAI image reconstruction failed: ${msg}`
    );
  }

  return Buffer.from(genJson.data[0].b64_json, "base64");
}

async function generateWithGemini(
  apiKey: string,
  referencePng: Buffer,
  prompt: string
): Promise<Buffer> {
  const b64 = referencePng.toString("base64");
  const candidateModels = [
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-exp-image-generation",
  ];

  let lastErrorMsg = "Gemini image generation unavailable";

  for (const modelName of candidateModels) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: b64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
        signal: AbortSignal.timeout(90000),
      }
    );

    const json = await res.json().catch(() => null);
    if (res.ok) {
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const inline = part?.inlineData ?? part?.inline_data;
        if (inline?.data && typeof inline.data === "string") {
          return Buffer.from(inline.data, "base64");
        }
      }
    } else {
      lastErrorMsg = json?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) break;
    }
  }

  throw new AiProviderError(
    lastErrorMsg,
    502,
    `Gemini image reconstruction failed: ${lastErrorMsg}`
  );
}
