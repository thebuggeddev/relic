import { NextResponse } from "next/server";
import type { UserArtifactContext } from "@/types/artifact";
import {
  getIsolatedAiCredentials,
  getOrCreateSessionId,
} from "@/lib/security/session-credentials";
import {
  createJob,
  validateAndNormalizeUpload,
} from "@/lib/storage/job-store";
import { runRestorationPipelineSteps1To3 } from "@/lib/ai/pipeline-runner";

export async function POST(request: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const aiCreds = await getIsolatedAiCredentials();

    if (!aiCreds) {
      return NextResponse.json(
        {
          error:
            "Please configure your Vision & Image AI API key in API Settings before uploading an artifact.",
          code: "MISSING_AI_KEY",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please attach a PNG, JPEG, or WebP artifact photograph." },
        { status: 400 }
      );
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const { normalizedBuffer } = await validateAndNormalizeUpload(
      rawBuffer,
      file.type
    );

    const str = (key: string): string | undefined => {
      const val = formData.get(key);
      return typeof val === "string" && val.trim().length > 0
        ? val.trim().slice(0, 400)
        : undefined;
    };

    const userContext: UserArtifactContext = {
      artifactName: str("artifactName"),
      archaeologicalSite: str("archaeologicalSite"),
      approximateEra: str("approximateEra"),
      museumReference: str("museumReference"),
      additionalNotes: str("additionalNotes"),
    };

    const job = await createJob(sessionId, normalizedBuffer, userContext);

    // Fire-and-forget asynchronous background pipeline
    void runRestorationPipelineSteps1To3({
      jobId: job.id,
      sessionId,
      provider: aiCreds.provider,
      aiApiKey: aiCreds.apiKey,
      normalizedImageBuffer: normalizedBuffer,
      userContext,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process uploaded artifact photograph.",
      },
      { status: 400 }
    );
  }
}
