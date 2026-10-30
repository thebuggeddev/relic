import { NextResponse } from "next/server";
import type { AiProvider } from "@/types/artifact";
import {
  clearSessionCredentials,
  getSessionStatus,
  setSessionCredentials,
} from "@/lib/security/session-credentials";
import {
  AiProviderError,
  validateAiProviderKey,
} from "@/lib/ai/analysis-and-research";
import { TripoApiError, validateTripoApiKey } from "@/lib/tripo/client";

export async function GET() {
  const status = await getSessionStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      aiProvider?: AiProvider;
      aiApiKey?: string;
      tripoApiKey?: string;
      validate?: boolean;
    };

    const provider: AiProvider =
      body.aiProvider === "gemini" ? "gemini" : "openai";
    const shouldValidate = body.validate !== false;

    let aiValidationModel: string | null = null;
    let tripoBalance: { balance: number; frozen: number } | null = null;

    if (shouldValidate && body.aiApiKey && body.aiApiKey.trim().length > 0) {
      const res = await validateAiProviderKey(provider, body.aiApiKey);
      aiValidationModel = res.modelLabel;
    }

    if (
      shouldValidate &&
      body.tripoApiKey &&
      body.tripoApiKey.trim().length > 0
    ) {
      tripoBalance = await validateTripoApiKey(body.tripoApiKey);
    }

    const status = await setSessionCredentials({
      aiProvider: body.aiProvider,
      aiApiKey: body.aiApiKey,
      tripoApiKey: body.tripoApiKey,
    });

    return NextResponse.json(
      {
        ...status,
        validation: {
          aiModel: aiValidationModel,
          tripoBalance: tripoBalance?.balance ?? null,
          tripoFrozen: tripoBalance?.frozen ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof AiProviderError) {
      return NextResponse.json(
        { error: err.userActionableMessage, field: "ai" },
        { status: err.statusCode }
      );
    }
    if (err instanceof TripoApiError) {
      return NextResponse.json(
        { error: err.userActionableMessage, field: "tripo" },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      {
        error:
          "Unable to validate credentials. Please inspect your keys and try again.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  await clearSessionCredentials();
  return NextResponse.json(
    { cleared: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
