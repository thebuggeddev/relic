import { NextResponse } from "next/server";
import type { Variation3DTaskState } from "@/types/artifact";
import {
  clearSessionCredentials,
  getCurrentSessionId,
  getIsolatedTripoCredential,
} from "@/lib/security/session-credentials";
import {
  acquireJobLock,
  getJobForSession,
  readJobAssetForSession,
  releaseJobLock,
  updateJobForSession,
  writeJobAsset,
} from "@/lib/storage/job-store";
import {
  createTripoImageToModelTask,
  createTripoMultiviewTask,
  createTripoMultiviewToModelTask,
  downloadRemoteBinary,
  getTripoTaskStatus,
  TripoApiError,
  uploadImageToTripo,
} from "@/lib/tripo/client";

async function startNextVariationTask(params: {
  jobId: string;
  sessionId: string;
  tripoKey: string;
  useMultiview: boolean;
  variation: Variation3DTaskState;
}): Promise<Variation3DTaskState> {
  const { jobId, sessionId, tripoKey, useMultiview, variation } = params;
  const filename = `${variation.hypothesisId}.png`;
  const asset = await readJobAssetForSession(jobId, sessionId, filename);
  if (!asset) {
    return {
      ...variation,
      status: "failed",
      error: `Missing hypothesis image ${filename}`,
    };
  }

  const fileToken = await uploadImageToTripo(
    tripoKey,
    asset.buffer,
    filename,
    "image/png"
  );

  if (useMultiview) {
    const mvTaskId = await createTripoMultiviewTask(tripoKey, fileToken);
    return {
      ...variation,
      status: "generating_multiview",
      tripoMultiviewTaskId: mvTaskId,
      tripoTaskId: undefined,
    };
  }

  const taskId = await createTripoImageToModelTask(tripoKey, fileToken, {
    model: "v3.1-20260211",
    faceLimit: 40000,
    enableImageAutofix: false,
    textureAlignment: "original_image",
    textureQuality: "detailed",
    orientation: "default",
  });

  return {
    ...variation,
    status: "generating_3d",
    tripoTaskId: taskId,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  let job = await getJobForSession(jobId, sessionId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const autoClearOnComplete = url.searchParams.get("ephemeralPurge") === "1";

  // If job is actively polling Tripo v3, advance its asynchronous task state safely
  if (
    (job.status === "generating_multiview" || job.status === "generating_3d") &&
    acquireJobLock(jobId)
  ) {
    try {
      const tripoKey = await getIsolatedTripoCredential();
      if (!tripoKey) {
        job = await updateJobForSession(jobId, sessionId, {
          status: "failed",
          error:
            "Tripo API session credential expired before 3D generation finished. Re-enter your Tripo key in API Settings.",
        });
      } else if (job.variationTasks && job.variationTasks.length > 0) {
        const tasks = [...job.variationTasks];
        const total = tasks.length;
        const activeIdx = tasks.findIndex(
          (t) =>
            t.status === "generating_multiview" || t.status === "generating_3d"
        );

        if (activeIdx >= 0) {
          const current = tasks[activeIdx];
          const variantTag =
            total > 1 ? `${current.label} (${activeIdx + 1}/${total})` : current.label;

          if (
            current.status === "generating_multiview" &&
            current.tripoMultiviewTaskId
          ) {
            const mv = await getTripoTaskStatus(
              tripoKey,
              current.tripoMultiviewTaskId
            );
            if (mv.status === "success") {
              const modelTaskId = await createTripoMultiviewToModelTask(
                tripoKey,
                { taskId: current.tripoMultiviewTaskId },
                { faceLimit: 40000 }
              );
              tasks[activeIdx] = {
                ...current,
                status: "generating_3d",
                tripoTaskId: modelTaskId,
              };
              const overallProg = Math.round(
                ((activeIdx + 0.42) / total) * 94 + 4
              );
              job = await updateJobForSession(jobId, sessionId, {
                status: "generating_3d",
                tripoTaskId: modelTaskId,
                multiviewUrls:
                  activeIdx === 0 ? mv.multiviewUrls : job.multiviewUrls,
                variationTasks: tasks,
                progress: overallProg,
                stepLabel: `Sculpting PBR 3D geometry for ${variantTag}`,
                stepDetail:
                  "Tripo v3 is constructing textured 3D topology from orthogonal multiview projections.",
              });
            } else if (
              mv.status === "failed" ||
              mv.status === "cancelled" ||
              mv.status === "banned"
            ) {
              tasks[activeIdx] = {
                ...current,
                status: "failed",
                error: `Multiview ${mv.status}`,
              };
              const nextIdx = tasks.findIndex((t) => t.status === "pending");
              if (nextIdx >= 0) {
                const startedNext = await startNextVariationTask({
                  jobId,
                  sessionId,
                  tripoKey,
                  useMultiview: Boolean(job.useMultiview),
                  variation: tasks[nextIdx],
                });
                tasks[nextIdx] = startedNext;
                job = await updateJobForSession(jobId, sessionId, {
                  status:
                    startedNext.status === "generating_multiview"
                      ? "generating_multiview"
                      : "generating_3d",
                  tripoMultiviewTaskId: startedNext.tripoMultiviewTaskId,
                  tripoTaskId: startedNext.tripoTaskId,
                  variationTasks: tasks,
                });
              } else {
                const anySucceeded = tasks.find((t) => t.restoredModelUrl);
                if (anySucceeded?.restoredModelUrl) {
                  job = await updateJobForSession(jobId, sessionId, {
                    status: "completed",
                    progress: 100,
                    restoredModelUrl: anySucceeded.restoredModelUrl,
                    variationTasks: tasks,
                  });
                } else {
                  job = await updateJobForSession(jobId, sessionId, {
                    status: "failed",
                    variationTasks: tasks,
                    error: `Tripo multiview preparation ${mv.status}. Try disabling Multiview or choosing another hypothesis.`,
                  });
                }
              }
            } else {
              const withinVariant = Math.max(
                0.05,
                Math.min(0.4, (mv.progress / 100) * 0.4)
              );
              const overallProg = Math.round(
                ((activeIdx + withinVariant) / total) * 94 + 4
              );
              job = await updateJobForSession(jobId, sessionId, {
                progress: overallProg,
                stepLabel: `Generating multiview for ${variantTag}`,
                stepDetail: `Tripo v3 multiview task ${mv.status} (${mv.progress}%)`,
              });
            }
          } else if (
            current.status === "generating_3d" &&
            current.tripoTaskId
          ) {
            const poll = await getTripoTaskStatus(tripoKey, current.tripoTaskId);
            if (poll.status === "success" && poll.glbDownloadUrl) {
              const glbBuffer = await downloadRemoteBinary(poll.glbDownloadUrl);
              const glbFilename = `restored_${current.hypothesisId}.glb`;
              const localGlbUrl = await writeJobAsset(
                jobId,
                glbFilename,
                glbBuffer
              );

              let localPreviewUrl: string | undefined;
              if (poll.previewImageUrl) {
                try {
                  const previewBuf = await downloadRemoteBinary(
                    poll.previewImageUrl
                  );
                  localPreviewUrl = await writeJobAsset(
                    jobId,
                    `preview_${current.hypothesisId}.png`,
                    previewBuf
                  );
                } catch {
                  // Non-fatal preview save
                }
              }

              tasks[activeIdx] = {
                ...current,
                status: "completed",
                restoredModelUrl: localGlbUrl,
                previewRenderUrl: localPreviewUrl,
              };

              const updatedHypotheses = job.hypotheses?.map((h) =>
                h.id === current.hypothesisId
                  ? { ...h, restoredModelUrl: localGlbUrl }
                  : h
              );

              const nextIdx = tasks.findIndex((t) => t.status === "pending");
              if (nextIdx >= 0) {
                const nextVar = tasks[nextIdx];
                const startedNext = await startNextVariationTask({
                  jobId,
                  sessionId,
                  tripoKey,
                  useMultiview: Boolean(job.useMultiview),
                  variation: nextVar,
                });
                tasks[nextIdx] = startedNext;

                const overallProg = Math.round(((activeIdx + 1) / total) * 94 + 4);
                job = await updateJobForSession(jobId, sessionId, {
                  status:
                    startedNext.status === "generating_multiview"
                      ? "generating_multiview"
                      : "generating_3d",
                  tripoMultiviewTaskId: startedNext.tripoMultiviewTaskId,
                  tripoTaskId: startedNext.tripoTaskId,
                  variationTasks: tasks,
                  hypotheses: updatedHypotheses,
                  restoredModelUrl:
                    current.hypothesisId === job.selectedHypothesisId
                      ? localGlbUrl
                      : job.restoredModelUrl ?? localGlbUrl,
                  previewRenderUrl:
                    current.hypothesisId === job.selectedHypothesisId
                      ? localPreviewUrl
                      : job.previewRenderUrl,
                  progress: overallProg,
                  stepLabel: `Generating 3D mesh for ${startedNext.label} (${nextIdx + 1}/${total})`,
                  stepDetail: `${current.label} saved locally; synthesizing next reconstruction variant.`,
                });
              } else {
                const primaryTask =
                  tasks.find(
                    (t) =>
                      t.hypothesisId === job?.selectedHypothesisId &&
                      t.restoredModelUrl
                  ) ?? tasks.find((t) => t.restoredModelUrl);

                job = await updateJobForSession(jobId, sessionId, {
                  status: "completed",
                  progress: 100,
                  stepLabel:
                    total > 1
                      ? `All ${tasks.filter((t) => t.status === "completed").length} 3D Reconstruction Variants Ready`
                      : "3D Archaeological Reconstruction Ready",
                  stepDetail:
                    "PBR-textured GLB meshes verified and ready for interactive comparison.",
                  restoredModelUrl:
                    primaryTask?.restoredModelUrl ?? localGlbUrl,
                  previewRenderUrl:
                    primaryTask?.previewRenderUrl ?? localPreviewUrl,
                  variationTasks: tasks,
                  hypotheses: updatedHypotheses,
                });

                if (autoClearOnComplete) {
                  await clearSessionCredentials();
                }
              }
            } else if (
              poll.status === "failed" ||
              poll.status === "cancelled" ||
              poll.status === "banned"
            ) {
              tasks[activeIdx] = {
                ...current,
                status: "failed",
                error: `Tripo 3D ${poll.status}`,
              };
              const nextIdx = tasks.findIndex((t) => t.status === "pending");
              if (nextIdx >= 0) {
                const startedNext = await startNextVariationTask({
                  jobId,
                  sessionId,
                  tripoKey,
                  useMultiview: Boolean(job.useMultiview),
                  variation: tasks[nextIdx],
                });
                tasks[nextIdx] = startedNext;
                job = await updateJobForSession(jobId, sessionId, {
                  status:
                    startedNext.status === "generating_multiview"
                      ? "generating_multiview"
                      : "generating_3d",
                  tripoMultiviewTaskId: startedNext.tripoMultiviewTaskId,
                  tripoTaskId: startedNext.tripoTaskId,
                  variationTasks: tasks,
                });
              } else {
                const anySucceeded = tasks.find((t) => t.restoredModelUrl);
                if (anySucceeded?.restoredModelUrl) {
                  job = await updateJobForSession(jobId, sessionId, {
                    status: "completed",
                    progress: 100,
                    restoredModelUrl: anySucceeded.restoredModelUrl,
                    variationTasks: tasks,
                  });
                } else {
                  job = await updateJobForSession(jobId, sessionId, {
                    status: "failed",
                    variationTasks: tasks,
                    error: `Tripo 3D model generation ${poll.status}. Please retry or select an alternative reconstruction hypothesis.`,
                  });
                }
              }
            } else {
              const baseWithin = job.useMultiview ? 0.42 : 0.08;
              const spanWithin = job.useMultiview ? 0.54 : 0.88;
              const withinVariant =
                baseWithin +
                (Math.max(0, Math.min(100, poll.progress)) / 100) * spanWithin;
              const overallProg = Math.round(
                ((activeIdx + withinVariant) / total) * 94 + 4
              );
              job = await updateJobForSession(jobId, sessionId, {
                progress: overallProg,
                stepLabel: `Generating 3D mesh for ${variantTag}`,
                stepDetail: `Tripo task ${poll.status} (${poll.progress}%)`,
              });
            }
          }
        }
      } else if (
        job.status === "generating_multiview" &&
        job.tripoMultiviewTaskId
      ) {
        const mv = await getTripoTaskStatus(tripoKey, job.tripoMultiviewTaskId);
        if (mv.status === "success") {
          // Chain directly into multiview-to-model
          const modelTaskId = await createTripoMultiviewToModelTask(tripoKey, {
            taskId: job.tripoMultiviewTaskId,
          });
          job = await updateJobForSession(jobId, sessionId, {
            status: "generating_3d",
            tripoTaskId: modelTaskId,
            multiviewUrls: mv.multiviewUrls,
            progress: 42,
            stepLabel: "Sculpting PBR 3D geometry from multiview references",
            stepDetail:
              "Tripo v3 is constructing textured 3D topology from orthogonal Front, Left, Back, and Right projections.",
          });
        } else if (
          mv.status === "failed" ||
          mv.status === "cancelled" ||
          mv.status === "banned"
        ) {
          job = await updateJobForSession(jobId, sessionId, {
            status: "failed",
            error: `Tripo multiview preparation ${mv.status}. Try disabling Multiview or choosing another hypothesis.`,
          });
        } else {
          job = await updateJobForSession(jobId, sessionId, {
            progress: Math.max(8, Math.min(38, Math.round(mv.progress * 0.38))),
            stepLabel: "Generating orthogonal multiview references",
            stepDetail: `Tripo v3 multiview task ${mv.status} (${mv.progress}%)`,
          });
        }
      } else if (job.status === "generating_3d" && job.tripoTaskId) {
        const poll = await getTripoTaskStatus(tripoKey, job.tripoTaskId);
        if (poll.status === "success" && poll.glbDownloadUrl) {
          job = await updateJobForSession(jobId, sessionId, {
            status: "persisting_assets",
            progress: 94,
            stepLabel: "Persisting PBR GLB mesh & textures locally",
            stepDetail:
              "Archiving generated 3D model before temporary Tripo CDN link expires.",
          });

          const glbBuffer = await downloadRemoteBinary(poll.glbDownloadUrl);
          const glbFilename = `restored_${job.selectedHypothesisId || "model"}.glb`;
          const localGlbUrl = await writeJobAsset(jobId, glbFilename, glbBuffer);

          let localPreviewUrl: string | undefined;
          if (poll.previewImageUrl) {
            try {
              const previewBuf = await downloadRemoteBinary(poll.previewImageUrl);
              localPreviewUrl = await writeJobAsset(
                jobId,
                `preview_${job.selectedHypothesisId || "model"}.png`,
                previewBuf
              );
            } catch {
              // Non-fatal preview save
            }
          }

          const updatedHypotheses = job.hypotheses?.map((h) =>
            h.id === job?.selectedHypothesisId
              ? { ...h, restoredModelUrl: localGlbUrl }
              : h
          );

          job = await updateJobForSession(jobId, sessionId, {
            status: "completed",
            progress: 100,
            stepLabel: "3D Archaeological Reconstruction Ready",
            stepDetail:
              "PBR-textured GLB asset verified and loaded into the exhibition stage.",
            restoredModelUrl: localGlbUrl,
            previewRenderUrl: localPreviewUrl,
            hypotheses: updatedHypotheses,
          });

          if (autoClearOnComplete) {
            await clearSessionCredentials();
          }
        } else if (
          poll.status === "failed" ||
          poll.status === "cancelled" ||
          poll.status === "banned"
        ) {
          job = await updateJobForSession(jobId, sessionId, {
            status: "failed",
            error: `Tripo 3D model generation ${poll.status}. Please retry or select an alternative reconstruction hypothesis.`,
          });
        } else {
          const base = job.useMultiview ? 42 : 10;
          const span = job.useMultiview ? 50 : 82;
          const scaledProgress = Math.round(
            base + (Math.max(0, Math.min(100, poll.progress)) / 100) * span
          );
          job = await updateJobForSession(jobId, sessionId, {
            progress: scaledProgress,
            stepLabel: "Generating textured PBR 3D mesh via Tripo v3",
            stepDetail: `Tripo task ${poll.status} (${poll.progress}%)`,
          });
        }
      }
    } catch (err) {
      const msg =
        err instanceof TripoApiError
          ? err.userActionableMessage
          : err instanceof Error
            ? err.message
            : "Failed polling Tripo 3D generation status.";
      job = await updateJobForSession(jobId, sessionId, {
        status: "failed",
        error: msg,
      }).catch(() => job!);
    } finally {
      releaseJobLock(jobId);
    }
  }

  return NextResponse.json(
    { job },
    { headers: { "Cache-Control": "no-store" } }
  );
}
