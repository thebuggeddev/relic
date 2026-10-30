import { NextResponse } from "next/server";
import type { UserArtifactContext } from "@/types/artifact";
import {
  getCurrentSessionId,
  getIsolatedAiCredentials,
} from "@/lib/security/session-credentials";
import {
  getJobForSession,
  readJobAssetForSession,
  updateJobForSession,
} from "@/lib/storage/job-store";
import { runRestorationPipelineSteps1To3 } from "@/lib/ai/pipeline-runner";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const aiCreds = await getIsolatedAiCredentials();
  if (!aiCreds) {
    return NextResponse.json(
      { error: "Configure your AI API key in API Settings." },
      { status: 401 }
    );
  }

  const job = await getJobForSession(jobId, sessionId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const original = await readJobAssetForSession(
    jobId,
    sessionId,
    "original.png"
  );
  if (!original) {
    return NextResponse.json(
      { error: "Original uploaded photograph no longer available." },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    userContext?: UserArtifactContext;
  };

  const mergedContext: UserArtifactContext = {
    ...job.userContext,
    ...body.userContext,
  };

  const updated = await updateJobForSession(jobId, sessionId, {
    userContext: mergedContext,
    status: "analyzing",
    progress: 10,
    stepLabel: "Re-analyzing artifact with updated historical context",
    error: undefined,
  });

  void runRestorationPipelineSteps1To3({
    jobId,
    sessionId,
    provider: aiCreds.provider,
    aiApiKey: aiCreds.apiKey,
    normalizedImageBuffer: original.buffer,
    userContext: mergedContext,
  });

  return NextResponse.json({ job: updated }, { status: 202 });
}
