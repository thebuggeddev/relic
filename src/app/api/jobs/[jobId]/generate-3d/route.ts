import { NextResponse } from "next/server";
import type { Variation3DTaskState } from "@/types/artifact";
import {
  getCurrentSessionId,
  getIsolatedTripoCredential,
} from "@/lib/security/session-credentials";
import {
  acquireJobLock,
  getJobForSession,
  readJobAssetForSession,
  releaseJobLock,
  updateJobForSession,
} from "@/lib/storage/job-store";
import {
  createTripoImageToModelTask,
  createTripoMultiviewTask,
  TripoApiError,
  uploadImageToTripo,
} from "@/lib/tripo/client";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "Session expired. Re-configure API Settings." },
      { status: 401 }
    );
  }

  const tripoKey = await getIsolatedTripoCredential();
  if (!tripoKey) {
    return NextResponse.json(
      {
        error:
          "Please configure your Tripo AI API key in API Settings before generating a 3D model.",
        code: "MISSING_TRIPO_KEY",
      },
      { status: 401 }
    );
  }

  const job = await getJobForSession(jobId, sessionId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (!acquireJobLock(jobId)) {
    return NextResponse.json(
      { error: "A generation task is already running for this artifact." },
      { status: 409 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      hypothesisId?: string;
      useMultiview?: boolean;
      generateAllVariations?: boolean;
    };

    const selectedId =
      body.hypothesisId ||
      job.selectedHypothesisId ||
      job.hypotheses?.[0]?.id;

    const allHypotheses = job.hypotheses ?? [];
    const selectedHypothesis = allHypotheses.find((h) => h.id === selectedId);
    if (!selectedHypothesis) {
      return NextResponse.json(
        { error: "Selected reconstruction hypothesis was not found." },
        { status: 400 }
      );
    }

    const useMultiview = Boolean(body.useMultiview);
    const generateAllVariations =
      body.generateAllVariations !== undefined
        ? Boolean(body.generateAllVariations)
        : allHypotheses.length > 1;

    // Order queue so user's chosen hypothesis generates first, followed by remaining variants
    const orderedHypotheses = generateAllVariations
      ? [
          selectedHypothesis,
          ...allHypotheses.filter((h) => h.id !== selectedHypothesis.id),
        ]
      : [selectedHypothesis];

    const filename = `${selectedHypothesis.id}.png`;
    const asset = await readJobAssetForSession(jobId, sessionId, filename);
    if (!asset) {
      return NextResponse.json(
        { error: "Restored hypothesis image file is missing on server." },
        { status: 404 }
      );
    }

    const initialVariationTasks: Variation3DTaskState[] = orderedHypotheses.map(
      (h, idx) => ({
        hypothesisId: h.id,
        label: h.label,
        status:
          idx === 0
            ? useMultiview
              ? "generating_multiview"
              : "generating_3d"
            : "pending",
      })
    );

    await updateJobForSession(jobId, sessionId, {
      selectedHypothesisId: selectedHypothesis.id,
      useMultiview,
      generateAllVariations,
      variationTasks: initialVariationTasks,
      status: useMultiview ? "generating_multiview" : "generating_3d",
      progress: 6,
      stepLabel:
        orderedHypotheses.length > 1
          ? `Uploading ${selectedHypothesis.label} (1 of ${orderedHypotheses.length}) to Tripo v3`
          : "Uploading approved reconstruction to Tripo v3",
      stepDetail: "Requesting secure file_token for strict-fidelity 3D mesh synthesis.",
      error: undefined,
    });

    const fileToken = await uploadImageToTripo(
      tripoKey,
      asset.buffer,
      filename,
      "image/png"
    );

    if (useMultiview) {
      const mvTaskId = await createTripoMultiviewTask(tripoKey, fileToken);
      initialVariationTasks[0] = {
        ...initialVariationTasks[0],
        status: "generating_multiview",
        tripoMultiviewTaskId: mvTaskId,
      };
      const updated = await updateJobForSession(jobId, sessionId, {
        status: "generating_multiview",
        tripoMultiviewTaskId: mvTaskId,
        tripoTaskId: undefined,
        variationTasks: initialVariationTasks,
        progress: 10,
        stepLabel:
          orderedHypotheses.length > 1
            ? `Generating multiview for ${selectedHypothesis.label} (1/${orderedHypotheses.length})`
            : "Generating orthogonal multiview references",
        stepDetail:
          "Synthesizing consistent Front, Left, Back, and Right views before 3D meshing.",
      });
      return NextResponse.json({ job: updated }, { status: 202 });
    }

    const taskId = await createTripoImageToModelTask(tripoKey, fileToken, {
      model: "v3.1-20260211",
      faceLimit: 40000,
      enableImageAutofix: false,
      textureAlignment: "original_image",
      textureQuality: "detailed",
      orientation: "default",
    });

    initialVariationTasks[0] = {
      ...initialVariationTasks[0],
      status: "generating_3d",
      tripoTaskId: taskId,
    };

    const updated = await updateJobForSession(jobId, sessionId, {
      status: "generating_3d",
      tripoTaskId: taskId,
      variationTasks: initialVariationTasks,
      progress: 10,
      stepLabel:
        orderedHypotheses.length > 1
          ? `Generating 3D mesh for ${selectedHypothesis.label} (1/${orderedHypotheses.length})`
          : "Generating textured PBR 3D mesh via Tripo v3",
      stepDetail:
        "Tripo v3.1 queued with strict original-image texture lock & PBR materials.",
    });

    return NextResponse.json({ job: updated }, { status: 202 });
  } catch (err) {
    const message =
      err instanceof TripoApiError
        ? err.userActionableMessage
        : err instanceof Error
          ? err.message
          : "Failed initiating Tripo 3D generation.";

    await updateJobForSession(jobId, sessionId, {
      status: "failed",
      error: message,
    }).catch(() => {});

    return NextResponse.json(
      { error: message },
      { status: err instanceof TripoApiError ? err.statusCode : 502 }
    );
  } finally {
    releaseJobLock(jobId);
  }
}
