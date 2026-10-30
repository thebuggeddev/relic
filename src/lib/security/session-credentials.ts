import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { AiProvider, ApiSessionStatus } from "@/types/artifact";

/**
 * Ephemeral, session-scoped credential store.
 *
 * Security invariants:
 * 1. Keys are encrypted at rest in server process memory with a per-boot random AES-256-GCM key.
 * 2. Keys are NEVER written to disk, logs, URLs, analytics, or client responses.
 * 3. Session binding uses an HttpOnly, SameSite=Strict session cookie without Max-Age/Expires
 *    so credentials never persist across browser restarts and expire automatically after TTL.
 * 4. Strict domain isolation: AI provider keys and Tripo keys have separate accessors
 *    so credentials are never cross-sent between providers.
 */

const SESSION_COOKIE_NAME = "relic_ephemeral_sid";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours max ephemeral lifetime

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface SessionRecord {
  createdAt: number;
  expiresAt: number;
  aiProvider: AiProvider | null;
  encryptedAiKey: EncryptedBlob | null;
  maskedAiKey: string | null;
  encryptedTripoKey: EncryptedBlob | null;
  maskedTripoKey: string | null;
}

// Persist across Next.js hot reloads in dev while remaining strictly in-memory
const globalForCreds = globalThis as unknown as {
  __relicMasterKey?: Buffer;
  __relicSessions?: Map<string, SessionRecord>;
};

const MASTER_KEY =
  globalForCreds.__relicMasterKey ??
  (globalForCreds.__relicMasterKey = crypto.randomBytes(32));

const SESSIONS =
  globalForCreds.__relicSessions ??
  (globalForCreds.__relicSessions = new Map<string, SessionRecord>());

function encryptSecret(plain: string): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", MASTER_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

function decryptSecret(blob: EncryptedBlob): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    MASTER_KEY,
    Buffer.from(blob.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sid, record] of SESSIONS.entries()) {
    if (record.expiresAt <= now) {
      SESSIONS.delete(sid);
    }
  }
}

export async function getOrCreateSessionId(): Promise<string> {
  pruneExpiredSessions();
  const cookieStore = await cookies();
  let sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sid || sid.length < 32) {
    sid = crypto.randomBytes(24).toString("hex");
    cookieStore.set(SESSION_COOKIE_NAME, sid, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Intentionally omit maxAge/expires so browser treats it as an ephemeral session cookie
    });
  }
  return sid;
}

export async function getCurrentSessionId(): Promise<string | null> {
  pruneExpiredSessions();
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCredentials(input: {
  aiProvider?: AiProvider;
  aiApiKey?: string;
  tripoApiKey?: string;
}): Promise<ApiSessionStatus> {
  const sid = await getOrCreateSessionId();
  const now = Date.now();
  const existing = SESSIONS.get(sid);

  const nextRecord: SessionRecord = {
    createdAt: existing?.createdAt ?? now,
    expiresAt: now + SESSION_TTL_MS,
    aiProvider: input.aiProvider ?? existing?.aiProvider ?? null,
    encryptedAiKey: existing?.encryptedAiKey ?? null,
    maskedAiKey: existing?.maskedAiKey ?? null,
    encryptedTripoKey: existing?.encryptedTripoKey ?? null,
    maskedTripoKey: existing?.maskedTripoKey ?? null,
  };

  if (typeof input.aiApiKey === "string") {
    const cleaned = input.aiApiKey.trim();
    if (cleaned.length > 0) {
      nextRecord.encryptedAiKey = encryptSecret(cleaned);
      nextRecord.maskedAiKey = maskKey(cleaned);
      if (!nextRecord.aiProvider) {
        nextRecord.aiProvider = cleaned.startsWith("AIza") ? "gemini" : "openai";
      }
    } else {
      nextRecord.encryptedAiKey = null;
      nextRecord.maskedAiKey = null;
    }
  }

  if (typeof input.tripoApiKey === "string") {
    const cleaned = input.tripoApiKey.trim();
    if (cleaned.length > 0) {
      nextRecord.encryptedTripoKey = encryptSecret(cleaned);
      nextRecord.maskedTripoKey = maskKey(cleaned);
    } else {
      nextRecord.encryptedTripoKey = null;
      nextRecord.maskedTripoKey = null;
    }
  }

  SESSIONS.set(sid, nextRecord);
  return toStatus(nextRecord);
}

export async function getSessionStatus(): Promise<ApiSessionStatus> {
  const sid = await getCurrentSessionId();
  if (!sid) {
    return {
      hasAiKey: false,
      aiProvider: null,
      maskedAiKey: null,
      hasTripoKey: false,
      maskedTripoKey: null,
      ephemeralOnly: true,
    };
  }
  const record = SESSIONS.get(sid);
  if (!record) {
    return {
      hasAiKey: false,
      aiProvider: null,
      maskedAiKey: null,
      hasTripoKey: false,
      maskedTripoKey: null,
      ephemeralOnly: true,
    };
  }
  return toStatus(record);
}

export async function clearSessionCredentials(): Promise<void> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sid) {
    SESSIONS.delete(sid);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Isolated accessor exclusively for Vision / Image-Generation AI modules.
 * Never returns the Tripo credential.
 */
export async function getIsolatedAiCredentials(): Promise<{
  provider: AiProvider;
  apiKey: string;
} | null> {
  const sid = await getCurrentSessionId();
  if (!sid) return null;
  const record = SESSIONS.get(sid);
  if (!record || !record.encryptedAiKey || !record.aiProvider) return null;
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  return {
    provider: record.aiProvider,
    apiKey: decryptSecret(record.encryptedAiKey),
  };
}

/**
 * Isolated accessor exclusively for Tripo 3D API modules.
 * Never returns the Vision / Image-Generation credential.
 */
export async function getIsolatedTripoCredential(): Promise<string | null> {
  const sid = await getCurrentSessionId();
  if (!sid) return null;
  const record = SESSIONS.get(sid);
  if (!record || !record.encryptedTripoKey) return null;
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  return decryptSecret(record.encryptedTripoKey);
}

function toStatus(record: SessionRecord): ApiSessionStatus {
  return {
    hasAiKey: Boolean(record.encryptedAiKey),
    aiProvider: record.encryptedAiKey ? record.aiProvider : null,
    maskedAiKey: record.maskedAiKey,
    hasTripoKey: Boolean(record.encryptedTripoKey),
    maskedTripoKey: record.maskedTripoKey,
    ephemeralOnly: true,
  };
}
