import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { RestorationJob } from "@/types/artifact";
import { optimizeGlbBuffer } from "@/lib/tripo/optimize-glb";

const JOBS_ROOT = path.join(process.cwd(), "tmp-jobs");
const JOB_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours cleanup TTL
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

interface StoredJobMeta {
  ownerSessionId: string;
  job: RestorationJob;
}

const activeLocks = new Set<string>();

export function acquireJobLock(jobId: string): boolean {
  if (activeLocks.has(jobId)) return false;
  activeLocks.add(jobId);
  return true;
}

export function releaseJobLock(jobId: string): void {
  activeLocks.delete(jobId);
}

async function ensureJobsRoot(): Promise<void> {
  await fs.mkdir(JOBS_ROOT, { recursive: true });
}

export async function pruneExpiredJobs(): Promise<void> {
  try {
    await ensureJobsRoot();
    const entries = await fs.readdir(JOBS_ROOT, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (dir) => {
          const metaPath = path.join(JOBS_ROOT, dir.name, "job.json");
          try {
            const stat = await fs.stat(metaPath);
            if (now - stat.mtimeMs > JOB_TTL_MS) {
              await fs.rm(path.join(JOBS_ROOT, dir.name), {
                recursive: true,
                force: true,
              });
            }
          } catch {
            // Ignore partially removed dirs
          }
        })
    );
  } catch {
    // Non-fatal
  }
}

export async function validateAndNormalizeUpload(
  rawBuffer: Buffer,
  declaredMime: string
): Promise<{
  normalizedBuffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  width: number;
  height: number;
}> {
  if (rawBuffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (rawBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Image exceeds the 15 MB maximum upload size.");
  }
  if (declaredMime && !ALLOWED_MIME.has(declaredMime)) {
    throw new Error(
      "Unsupported file format. Please upload a PNG, JPEG, or WebP photograph."
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(rawBuffer).metadata();
  } catch {
    throw new Error(
      "Invalid or corrupted image file. Please upload a valid PNG, JPEG, or WebP photograph."
    );
  }

  if (
    !metadata.format ||
    !["png", "jpeg", "webp"].includes(metadata.format) ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error(
      "Unsupported image encoding. Only PNG, JPEG, and WebP photographs are supported."
    );
  }

  if (metadata.width < 128 || metadata.height < 128) {
    throw new Error(
      "Photograph resolution is too small (minimum 128×128 px). Please upload a clearer image of the artifact."
    );
  }

  // Strip EXIF GPS/personal metadata and cap max dimension to 1536px for crisp, reliable AI processing
  const pipeline = sharp(rawBuffer)
    .rotate() // honor orientation tag before stripping EXIF
    .resize({
      width: 1536,
      height: 1536,
      fit: "inside",
      withoutEnlargement: true,
    });

  const normalizedBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
  const finalMeta = await sharp(normalizedBuffer).metadata();

  return {
    normalizedBuffer,
    mimeType: "image/png",
    extension: "png",
    width: finalMeta.width ?? metadata.width,
    height: finalMeta.height ?? metadata.height,
  };
}

function sanitizeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    throw new Error("Invalid job identifier.");
  }
  return id;
}

export async function createJob(
  ownerSessionId: string,
  normalizedImageBuffer: Buffer,
  userContext?: RestorationJob["userContext"]
): Promise<RestorationJob> {
  await pruneExpiredJobs();
  const id = `job_${crypto.randomBytes(12).toString("hex")}`;
  const dir = path.join(JOBS_ROOT, id);
  await fs.mkdir(dir, { recursive: true });

  const originalFilename = "original.png";
  await fs.writeFile(path.join(dir, originalFilename), normalizedImageBuffer);

  const now = new Date().toISOString();
  const job: RestorationJob = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "uploaded",
    progress: 5,
    stepLabel: "Artifact photograph validated",
    uploadedImageUrl: `/api/jobs/${id}/assets/${originalFilename}`,
    uploadedMimeType: "image/png",
    userContext,
  };

  const stored: StoredJobMeta = {
    ownerSessionId,
    job,
  };

  await fs.writeFile(
    path.join(dir, "job.json"),
    JSON.stringify(stored, null, 2),
    "utf8"
  );

  return job;
}

export async function getJobForSession(
  jobId: string,
  ownerSessionId: string
): Promise<RestorationJob | null> {
  const safeId = sanitizeId(jobId);
  const metaPath = path.join(JOBS_ROOT, safeId, "job.json");
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as StoredJobMeta;
    if (parsed.ownerSessionId !== ownerSessionId) {
      return null;
    }
    return parsed.job;
  } catch {
    return null;
  }
}

export async function updateJobForSession(
  jobId: string,
  ownerSessionId: string,
  patch: Partial<RestorationJob>
): Promise<RestorationJob> {
  const safeId = sanitizeId(jobId);
  const metaPath = path.join(JOBS_ROOT, safeId, "job.json");
  const raw = await fs.readFile(metaPath, "utf8");
  const parsed = JSON.parse(raw) as StoredJobMeta;
  if (parsed.ownerSessionId !== ownerSessionId) {
    throw new Error("Unauthorized job access.");
  }

  const nextJob: RestorationJob = {
    ...parsed.job,
    ...patch,
    id: parsed.job.id,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    metaPath,
    JSON.stringify({ ownerSessionId, job: nextJob }, null, 2),
    "utf8"
  );

  return nextJob;
}

export async function writeJobAsset(
  jobId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const safeId = sanitizeId(jobId);
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(filename) || filename.includes("..")) {
    throw new Error("Invalid asset filename.");
  }
  const dir = path.join(JOBS_ROOT, safeId);
  await fs.mkdir(dir, { recursive: true });

  let outBuffer = buffer;
  if (filename.toLowerCase().endsWith(".glb")) {
    try {
      outBuffer = await optimizeGlbBuffer(buffer);
    } catch {
      outBuffer = buffer;
    }
  }

  await fs.writeFile(path.join(dir, filename), outBuffer);
  return `/api/jobs/${safeId}/assets/${filename}`;
}

export async function readJobAssetForSession(
  jobId: string,
  ownerSessionId: string,
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeId = sanitizeId(jobId);
  if (
    !/^[a-zA-Z0-9._-]{3,80}$/.test(filename) ||
    filename.includes("..") ||
    filename === "job.json"
  ) {
    return null;
  }
  const job = await getJobForSession(safeId, ownerSessionId);
  if (!job) return null;

  const filePath = path.join(JOBS_ROOT, safeId, filename);
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".glb"
        ? "model/gltf-binary"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".webp"
              ? "image/webp"
              : "application/octet-stream";
    return { buffer, contentType };
  } catch {
    return null;
  }
}
