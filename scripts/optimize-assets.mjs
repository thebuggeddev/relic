import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SHOWCASE_DIR = path.join(ROOT, "public", "showcase");

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function pad4(len) {
  return (4 - (len % 4)) % 4;
}

async function optimizeGlbBuffer(rawGlb) {
  if (rawGlb.byteLength < 28) return rawGlb;
  if (rawGlb.readUInt32LE(0) !== GLB_MAGIC) return rawGlb;
  if (rawGlb.readUInt32LE(4) !== 2) return rawGlb;

  let offset = 12;
  let jsonChunk = null;
  let binChunk = null;

  while (offset + 8 <= rawGlb.byteLength) {
    const chunkLen = rawGlb.readUInt32LE(offset);
    const chunkType = rawGlb.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLen;
    if (chunkEnd > rawGlb.byteLength) break;

    if (chunkType === CHUNK_JSON && !jsonChunk) {
      jsonChunk = rawGlb.subarray(chunkStart, chunkEnd);
    } else if (chunkType === CHUNK_BIN && !binChunk) {
      binChunk = rawGlb.subarray(chunkStart, chunkEnd);
    }
    offset = chunkEnd;
  }

  if (!jsonChunk || !binChunk) return rawGlb;

  const json = JSON.parse(jsonChunk.toString("utf8"));
  const bufferViews = json.bufferViews;
  const buffers = json.buffers;
  if (!bufferViews || !buffers || buffers.length !== 1 || buffers[0].uri) {
    return rawGlb;
  }

  const imageRoles = new Map();
  const textures = json.textures ?? [];
  const resolveSource = (texIdx) =>
    texIdx !== undefined ? textures[texIdx]?.source : undefined;

  for (const mat of json.materials ?? []) {
    const baseSrc = resolveSource(mat.pbrMetallicRoughness?.baseColorTexture?.index);
    if (baseSrc !== undefined) imageRoles.set(baseSrc, "color");

    const emSrc = resolveSource(mat.emissiveTexture?.index);
    if (emSrc !== undefined && !imageRoles.has(emSrc)) imageRoles.set(emSrc, "color");

    const ormSrc = resolveSource(
      mat.pbrMetallicRoughness?.metallicRoughnessTexture?.index
    );
    if (ormSrc !== undefined && !imageRoles.has(ormSrc)) imageRoles.set(ormSrc, "orm");

    const occSrc = resolveSource(mat.occlusionTexture?.index);
    if (occSrc !== undefined && !imageRoles.has(occSrc)) imageRoles.set(occSrc, "orm");

    const normSrc = resolveSource(mat.normalTexture?.index);
    if (normSrc !== undefined && !imageRoles.has(normSrc)) {
      imageRoles.set(normSrc, "normal");
    }
  }

  const bvRefCount = new Array(bufferViews.length).fill(0);
  for (const acc of json.accessors ?? []) {
    if (acc.bufferView !== undefined) bvRefCount[acc.bufferView]++;
  }
  for (const img of json.images ?? []) {
    if (img.bufferView !== undefined) bvRefCount[img.bufferView]++;
  }

  const replacementSlices = new Map();
  const images = json.images ?? [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.bufferView === undefined || bvRefCount[img.bufferView] !== 1) continue;

    const bv = bufferViews[img.bufferView];
    const start = bv.byteOffset ?? 0;
    const rawImg = binChunk.subarray(start, start + bv.byteLength);

    const nameLower = (img.name ?? "").toLowerCase();
    const role =
      imageRoles.get(i) ??
      (nameLower.includes("normal")
        ? "normal"
        : nameLower.includes("orm") || nameLower.includes("rough")
          ? "orm"
          : "color");

    const meta = await sharp(rawImg).metadata();
    const hasSignificantAlpha = Boolean(meta.hasAlpha) && role === "color";

    let targetDim = 1536;
    if (role === "normal") targetDim = 1024;
    else if (role === "orm") targetDim = 512;

    let pipe = sharp(rawImg).resize(targetDim, targetDim, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    });

    if (role === "color") {
      pipe = pipe.sharpen({ sigma: 0.4 });
    }

    let encoded;
    let nextMime = "image/jpeg";

    if (hasSignificantAlpha) {
      const stats = await sharp(rawImg).stats();
      const minAlpha = stats.channels[3]?.min ?? 255;
      if (minAlpha < 250) {
        encoded = await pipe.png({ compressionLevel: 9 }).toBuffer();
        nextMime = "image/png";
      } else {
        encoded = await pipe
          .flatten({ background: "#000000" })
          .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" })
          .toBuffer();
      }
    } else if (role === "normal") {
      encoded = await pipe
        .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer();
    } else if (role === "orm") {
      encoded = await pipe.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    } else {
      encoded = await pipe
        .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" })
        .toBuffer();
    }

    if (encoded.byteLength < rawImg.byteLength) {
      replacementSlices.set(img.bufferView, encoded);
      img.mimeType = nextMime;
    }
  }

  const indexAccessorIndices = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if (prim.indices !== undefined) indexAccessorIndices.add(prim.indices);
    }
  }

  const accessors = json.accessors ?? [];
  for (const accIdx of indexAccessorIndices) {
    const acc = accessors[accIdx];
    if (!acc || acc.componentType !== 5125 || acc.type !== "SCALAR") continue;
    if (acc.bufferView === undefined || bvRefCount[acc.bufferView] !== 1) continue;
    if ((acc.byteOffset ?? 0) !== 0) continue;

    const bv = bufferViews[acc.bufferView];
    const start = bv.byteOffset ?? 0;
    const rawSlice = binChunk.subarray(start, start + bv.byteLength);
    if (rawSlice.byteLength < acc.count * 4) continue;

    let maxVal = acc.max?.[0];
    if (maxVal === undefined) {
      maxVal = 0;
      for (let k = 0; k < acc.count; k++) {
        const v = rawSlice.readUInt32LE(k * 4);
        if (v > maxVal) maxVal = v;
      }
    }

    if (maxVal < 65535) {
      const u16Buf = Buffer.allocUnsafe(acc.count * 2);
      for (let k = 0; k < acc.count; k++) {
        u16Buf.writeUInt16LE(rawSlice.readUInt32LE(k * 4), k * 2);
      }
      replacementSlices.set(acc.bufferView, u16Buf);
      acc.componentType = 5123;
      acc.byteOffset = 0;
    }
  }

  if (textures.length > 0 && (!json.samplers || json.samplers.length === 0)) {
    json.samplers = [
      { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 },
    ];
    for (const tex of textures) {
      if (tex.sampler === undefined) tex.sampler = 0;
    }
  }

  if (replacementSlices.size === 0) return rawGlb;

  const binParts = [];
  let runningBinOffset = 0;

  for (let bvIdx = 0; bvIdx < bufferViews.length; bvIdx++) {
    const bv = bufferViews[bvIdx];
    const origStart = bv.byteOffset ?? 0;
    const slice =
      replacementSlices.get(bvIdx) ??
      binChunk.subarray(origStart, origStart + bv.byteLength);

    bv.byteOffset = runningBinOffset;
    bv.byteLength = slice.byteLength;
    binParts.push(slice);
    runningBinOffset += slice.byteLength;

    const pad = pad4(slice.byteLength);
    if (pad > 0) {
      binParts.push(Buffer.alloc(pad, 0));
      runningBinOffset += pad;
    }
  }

  buffers[0].byteLength = runningBinOffset;
  const newBinChunk = Buffer.concat(binParts, runningBinOffset);

  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = pad4(jsonBytes.byteLength);
  const newJsonChunk =
    jsonPad > 0
      ? Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)])
      : jsonBytes;

  const totalLength = 12 + 8 + newJsonChunk.byteLength + 8 + newBinChunk.byteLength;
  const out = Buffer.allocUnsafe(totalLength);

  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);

  out.writeUInt32LE(newJsonChunk.byteLength, 12);
  out.writeUInt32LE(CHUNK_JSON, 16);
  newJsonChunk.copy(out, 20);

  const binHeaderPos = 20 + newJsonChunk.byteLength;
  out.writeUInt32LE(newBinChunk.byteLength, binHeaderPos);
  out.writeUInt32LE(CHUNK_BIN, binHeaderPos + 4);
  newBinChunk.copy(out, binHeaderPos + 8);

  return out;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function convertPngToWebp(pngPath, maxDim, quality = 86, alphaQuality = 92) {
  if (!(await fileExists(pngPath))) return null;
  const raw = await fs.readFile(pngPath);
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  const out = await sharp(raw)
    .resize(maxDim, maxDim, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .webp({ quality, alphaQuality, effort: 5 })
    .toBuffer();

  await fs.writeFile(webpPath, out);
  await fs.unlink(pngPath);
  return { before: raw.byteLength, after: out.byteLength, webpPath };
}

async function main() {
  let bytesBefore = 0;
  let bytesAfter = 0;

  // 1. Optimize top-level pedestal textures & ornament
  const pedSidePath = path.join(SHOWCASE_DIR, "pedestal-side.jpg");
  if (await fileExists(pedSidePath)) {
    const raw = await fs.readFile(pedSidePath);
    const out = await sharp(raw)
      .resize(768, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    if (out.byteLength < raw.byteLength) {
      await fs.writeFile(pedSidePath, out);
    }
    bytesBefore += raw.byteLength;
    bytesAfter += Math.min(raw.byteLength, out.byteLength);
    console.log(
      `pedestal-side.jpg: ${(raw.byteLength / 1024).toFixed(0)}KB -> ${(out.byteLength / 1024).toFixed(0)}KB`
    );
  }

  const pedTopPath = path.join(SHOWCASE_DIR, "pedestal-top.jpg");
  if (await fileExists(pedTopPath)) {
    const raw = await fs.readFile(pedTopPath);
    const out = await sharp(raw)
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    if (out.byteLength < raw.byteLength) {
      await fs.writeFile(pedTopPath, out);
    }
    bytesBefore += raw.byteLength;
    bytesAfter += Math.min(raw.byteLength, out.byteLength);
    console.log(
      `pedestal-top.jpg:  ${(raw.byteLength / 1024).toFixed(0)}KB -> ${(out.byteLength / 1024).toFixed(0)}KB`
    );
  }

  const ornRes = await convertPngToWebp(
    path.join(SHOWCASE_DIR, "pedestal-ornament.png"),
    1024,
    84,
    90
  );
  if (ornRes) {
    bytesBefore += ornRes.before;
    bytesAfter += ornRes.after;
    console.log(
      `pedestal-ornament: ${(ornRes.before / 1024).toFixed(0)}KB -> ${(ornRes.after / 1024).toFixed(0)}KB (.webp)`
    );
  }

  // 2. Optimize each exhibit directory
  const entries = await fs.readdir(SHOWCASE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(SHOWCASE_DIR, entry.name);

    // Remove unused duplicate files (restored.glb, restored.png, preview.png)
    for (const unused of ["restored.glb", "restored.png", "preview.png"]) {
      const p = path.join(dir, unused);
      if (await fileExists(p)) {
        const st = await fs.stat(p);
        bytesBefore += st.size;
        await fs.unlink(p);
        console.log(`Removed unused duplicate ${entry.name}/${unused} (${(st.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }

    // Optimize hyp-1..3.glb
    for (const glbName of ["hyp-1.glb", "hyp-2.glb", "hyp-3.glb"]) {
      const glbPath = path.join(dir, glbName);
      if (await fileExists(glbPath)) {
        const raw = await fs.readFile(glbPath);
        const opt = await optimizeGlbBuffer(raw);
        await fs.writeFile(glbPath, opt);
        bytesBefore += raw.byteLength;
        bytesAfter += opt.byteLength;
        console.log(
          `${entry.name}/${glbName}: ${(raw.byteLength / 1024 / 1024).toFixed(2)} MB -> ${(opt.byteLength / 1024 / 1024).toFixed(2)} MB`
        );
      }
    }

    // Convert 2D PNGs to crisp alpha WebP
    for (const [pngName, maxDim] of [
      ["hyp-1.png", 840],
      ["hyp-2.png", 840],
      ["hyp-3.png", 840],
      ["sketch.png", 800],
      ["original-cutout.png", 720],
    ]) {
      const res = await convertPngToWebp(path.join(dir, pngName), maxDim, 86, 92);
      if (res) {
        bytesBefore += res.before;
        bytesAfter += res.after;
        console.log(
          `${entry.name}/${pngName.replace(".png", ".webp")}: ${(res.before / 1024).toFixed(0)}KB -> ${(res.after / 1024).toFixed(0)}KB`
        );
      }
    }

    // Optimize original.jpg
    const origJpg = path.join(dir, "original.jpg");
    if (await fileExists(origJpg)) {
      const raw = await fs.readFile(origJpg);
      const out = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      if (out.byteLength < raw.byteLength) {
        await fs.writeFile(origJpg, out);
      }
      bytesBefore += raw.byteLength;
      bytesAfter += Math.min(raw.byteLength, out.byteLength);
    }
  }

  console.log(
    `\n✓ Total showcase asset footprint reduced from ${(bytesBefore / 1024 / 1024).toFixed(2)} MB to ${(bytesAfter / 1024 / 1024).toFixed(2)} MB (-${(((bytesBefore - bytesAfter) / bytesBefore) * 100).toFixed(1)}%)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
