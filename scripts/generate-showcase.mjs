import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const SHOWCASE_CONFIG_PATH = path.join(
  ROOT,
  "scripts",
  "showcase-manifest.json"
);
const PUBLIC_SHOWCASE_DIR = path.join(ROOT, "public", "showcase");
const TRIPO_V3_BASE = "https://openapi.tripo3d.ai/v3";

function loadEnvLocal() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(".env.local not found");
  }
  const map = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      map[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return map;
}

async function existsNonEmpty(filePath) {
  try {
    const st = await fsp.stat(filePath);
    return st.size > 512;
  } catch {
    return false;
  }
}

async function fetchMuseumOriginalPhoto(entry, outOriginalPath) {
  if (await existsNonEmpty(outOriginalPath)) {
    console.log(`[${entry.id}] Original museum photo already cached.`);
    return;
  }

  let imageUrl = entry.directImageUrl;

  if (entry.metObjectId) {
    const metaRes = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${entry.metObjectId}`
    );
    if (!metaRes.ok) {
      throw new Error(
        `Met API failed for object ${entry.metObjectId}: HTTP ${metaRes.status}`
      );
    }
    const meta = await metaRes.json();
    console.log(
      `[${entry.id}] Verified Met Object ${meta.objectID}: "${meta.title}" (${meta.accessionNumber}), isPublicDomain=${meta.isPublicDomain}`
    );
    imageUrl = meta.primaryImageSmall || meta.primaryImage || imageUrl;
  }

  if (!imageUrl) {
    throw new Error(`[${entry.id}] No open-access museum image URL resolved.`);
  }

  const imgRes = await fetch(imageUrl, {
    headers: {
      "User-Agent": "RelicRebornDigitalArchaeologyExhibit/1.0",
    },
  });
  if (!imgRes.ok) {
    throw new Error(
      `[${entry.id}] Failed downloading museum image (${imgRes.status}) from ${imageUrl}`
    );
  }

  const rawBuf = Buffer.from(await imgRes.arrayBuffer());
  const normalized = await sharp(rawBuf)
    .rotate()
    .resize({
      width: 1280,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  await fsp.writeFile(outOriginalPath, normalized);
  console.log(
    `[${entry.id}] Saved authentic museum reference photo (${normalized.byteLength} bytes).`
  );
}

async function generateRestoredImageOpenAI(
  openAiKey,
  originalPath,
  prompt,
  outPngPath
) {
  if (await existsNonEmpty(outPngPath)) {
    console.log(`  -> Hypothesis image already exists: ${path.basename(outPngPath)}`);
    return;
  }

  const refPng = await sharp(originalPath)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 22, g: 34, b: 37, alpha: 1 },
    })
    .png()
    .toBuffer();

  const fullPrompt = `${prompt}

CRITICAL ARCHAEOLOGICAL CONSERVATION REQUIREMENTS:
- Preserve the surviving structure, authentic proportions, visible patterns/inscriptions, and natural material texture of the museum artifact in the reference photograph.
- Reconstruct ONLY the missing, broken, or eroded portions in historically documented style so the complete artifact stands whole and intact as originally created.
- Do NOT include pedestals, museum mounts, split screens, text, labels, hands, or display cases.
- Show the single complete 3D-ready artifact centered upright in full unobstructed view against a clean smooth dark neutral charcoal studio background (#182427) with balanced studio illumination.`;

  const form = new FormData();
  form.append("model", "gpt-image-1.5");
  form.append("prompt", fullPrompt);
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("moderation", "low");
  form.append(
    "image",
    new Blob([new Uint8Array(refPng)], { type: "image/png" }),
    "original.png"
  );

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
    },
    body: form,
  });

  const json = await res.json().catch(() => null);
  let outBuf;

  if (res.ok && json?.data?.[0]?.b64_json) {
    outBuf = Buffer.from(json.data[0].b64_json, "base64");
  } else {
    console.warn(
      `  [Fallback] images/edits returned ${res.status} (${
        json?.error?.message || "fallback"
      }); conditioning via GPT-4o Vision + gpt-image-1.5...`
    );
    const b64Ref = refPng.toString("base64");
    const visRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
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
                text: `Write a precise 150-word museum studio photography prompt that reconstructs the damaged artifact in this image according to this conservation brief:\n${fullPrompt}\nDescribe its exact color, material texture, proportions, and surviving visual details so the generated image closely matches the original artifact's surviving parts while completing the missing sections cleanly on a solid dark charcoal background (#182427) with no pedestal or text.`,
              },
            ],
          },
        ],
      }),
    });
    const visJson = await visRes.json();
    const refinedPrompt =
      visJson?.choices?.[0]?.message?.content?.trim() || fullPrompt;

    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: refinedPrompt,
        size: "1024x1024",
        quality: "medium",
        moderation: "low",
      }),
    });
    const genJson = await genRes.json().catch(() => null);
    if (!genRes.ok || !genJson?.data?.[0]?.b64_json) {
      throw new Error(
        `OpenAI image generation failed (${genRes.status}): ${JSON.stringify(
          genJson?.error ?? genJson
        )}`
      );
    }
    outBuf = Buffer.from(genJson.data[0].b64_json, "base64");
  }
  // Compress to crisp optimized PNG
  const optimized = await sharp(outBuf)
    .resize(1024, 1024, { fit: "inside" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fsp.writeFile(outPngPath, optimized);
  console.log(
    `  -> Generated restored hypothesis ${path.basename(outPngPath)} (${optimized.byteLength} bytes)`
  );
}

async function generateTripo3DModel(tripoKey, inputPngPath, outGlbPath, outPreviewPath) {
  if (await existsNonEmpty(outGlbPath)) {
    console.log(`  -> Tripo 3D GLB already exists: ${path.basename(outGlbPath)}`);
    return;
  }

  const imgBuf = await fsp.readFile(inputPngPath);
  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new Blob([new Uint8Array(imgBuf)], { type: "image/png" }),
    path.basename(inputPngPath)
  );

  const upRes = await fetch(`${TRIPO_V3_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tripoKey}` },
    body: uploadForm,
  });
  const upJson = await upRes.json();
  if (!upRes.ok || upJson.code !== 0 || !upJson.data?.file_token) {
    throw new Error(`Tripo file upload failed: ${JSON.stringify(upJson)}`);
  }

  const fileToken = upJson.data.file_token;
  console.log(`  -> Uploaded to Tripo v3 (token=${fileToken.slice(0, 12)}...)`);

  const taskRes = await fetch(`${TRIPO_V3_BASE}/generation/image-to-model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tripoKey}`,
    },
    body: JSON.stringify({
      input: fileToken,
      model: "v3.1-20260211",
      texture: true,
      pbr: true,
      face_limit: 28000,
      enable_image_autofix: true,
    }),
  });
  const taskJson = await taskRes.json();
  if (!taskRes.ok || taskJson.code !== 0 || !taskJson.data?.task_id) {
    throw new Error(`Tripo task creation failed: ${JSON.stringify(taskJson)}`);
  }

  const taskId = taskJson.data.task_id;
  console.log(`  -> Tripo v3 task started: ${taskId}`);

  // Poll until completion
  const started = Date.now();
  while (Date.now() - started < 8 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 4000));
    const pollRes = await fetch(`${TRIPO_V3_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${tripoKey}` },
    });
    const pollJson = await pollRes.json();
    if (!pollRes.ok || pollJson.code !== 0) {
      throw new Error(`Tripo poll failed: ${JSON.stringify(pollJson)}`);
    }

    const st = pollJson.data?.status;
    const prog = pollJson.data?.progress ?? 0;
    process.stdout.write(`     [${taskId.slice(0, 10)}] ${st} ${prog}%\n`);

    if (st === "success") {
      const out = pollJson.data.output || {};
      const pick = (...keys) => {
        for (const k of keys) {
          const v = out[k];
          if (typeof v === "string" && v.startsWith("http")) return v;
          if (v && typeof v === "object" && typeof v.url === "string")
            return v.url;
        }
        return null;
      };
      const glbUrl = pick("pbr_model", "model", "model_url", "base_model");
      const prevUrl = pick("rendered_image", "rendered_image_url");
      if (!glbUrl) {
        throw new Error(
          `Tripo succeeded without GLB URL: ${JSON.stringify(out)}`
        );
      }

      const glbRes = await fetch(glbUrl);
      if (!glbRes.ok) {
        throw new Error(`Failed downloading GLB (${glbRes.status})`);
      }
      const glbBuf = Buffer.from(await glbRes.arrayBuffer());
      await fsp.writeFile(outGlbPath, glbBuf);
      console.log(
        `  -> Saved persisted GLB: ${outGlbPath} (${(
          glbBuf.byteLength /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );

      if (prevUrl && outPreviewPath) {
        try {
          const pr = await fetch(prevUrl);
          if (pr.ok) {
            await fsp.writeFile(
              outPreviewPath,
              Buffer.from(await pr.arrayBuffer())
            );
          }
        } catch {
          // Optional preview
        }
      }
      return;
    }

    if (st === "failed" || st === "cancelled" || st === "banned") {
      throw new Error(`Tripo task ended with status: ${st}`);
    }
  }

  throw new Error(`Tripo task ${taskId} timed out after 8 minutes`);
}

async function processArtifactEntry(entry, env) {
  const dir = path.join(PUBLIC_SHOWCASE_DIR, entry.id);
  await fsp.mkdir(dir, { recursive: true });

  const originalPath = path.join(dir, "original.jpg");
  await fetchMuseumOriginalPhoto(entry, originalPath);

  // Generate the 3 visual reconstruction hypotheses
  for (const hyp of entry.hypotheses) {
    const outPng = path.join(dir, `${hyp.id}.png`);
    await generateRestoredImageOpenAI(
      env.OPENAI_API_KEY,
      originalPath,
      hyp.prompt,
      outPng
    );
  }

  // Generate complete textured PBR 3D model via Tripo v3 from primary hypothesis (hyp-1.png)
  const primaryPng = path.join(dir, "hyp-1.png");
  const outGlb = path.join(dir, "restored.glb");
  const outPreview = path.join(dir, "preview.png");
  await generateTripo3DModel(
    env.TRIPO_API_KEY,
    primaryPng,
    outGlb,
    outPreview
  );
}

async function main() {
  const env = loadEnvLocal();
  if (!env.TRIPO_API_KEY || !env.OPENAI_API_KEY) {
    throw new Error(
      "Both TRIPO_API_KEY and OPENAI_API_KEY are required in .env.local to pre-generate showcase assets."
    );
  }

  const manifest = JSON.parse(
    await fsp.readFile(SHOWCASE_CONFIG_PATH, "utf8")
  );

  // Run sequentially across 5 artifacts (or 2 at a time) to respect API concurrency limits cleanly
  const CONCURRENCY = 2;
  const queue = [...manifest];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      console.log(`\n=== Processing Showcase Artifact: ${next.id} ===`);
      await processArtifactEntry(next, env);
    }
  });

  await Promise.all(workers);
  console.log("\nAll 5 showcase artifacts generated and persisted under public/showcase/!");
}

main().catch((err) => {
  console.error("Showcase generation error:", err.message);
  process.exit(1);
});
