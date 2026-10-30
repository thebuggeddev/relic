import type {
  AiProvider,
  ReconstructionHypothesis,
  UserArtifactContext,
} from "@/types/artifact";
import {
  acquireJobLock,
  releaseJobLock,
  updateJobForSession,
  writeJobAsset,
} from "@/lib/storage/job-store";
import {
  AiProviderError,
  analyzeUploadedArtifact,
  conductHistoricalResearch,
} from "@/lib/ai/analysis-and-research";
import { generateRestoredArtifactImage } from "@/lib/ai/image-restoration";

export async function runRestorationPipelineSteps1To3(params: {
  jobId: string;
  sessionId: string;
  provider: AiProvider;
  aiApiKey: string;
  normalizedImageBuffer: Buffer;
  userContext?: UserArtifactContext;
}): Promise<void> {
  const {
    jobId,
    sessionId,
    provider,
    aiApiKey,
    normalizedImageBuffer,
    userContext,
  } = params;

  if (!acquireJobLock(jobId)) return;

  try {
    await updateJobForSession(jobId, sessionId, {
      status: "analyzing",
      progress: 14,
      stepLabel: "Examining surviving morphology & fractures",
      stepDetail:
        "Inspecting object typology, probable material, break edges, and surviving decorative motifs.",
      error: undefined,
      errorCode: undefined,
    });

    const analysis = await analyzeUploadedArtifact({
      provider,
      apiKey: aiApiKey,
      imageBuffer: normalizedImageBuffer,
      userContext,
    });

    await updateJobForSession(jobId, sessionId, {
      analysis,
      status: "researching",
      progress: 34,
      stepLabel: "Querying museum collections & typological parallels",
      stepDetail:
        "Cross-referencing The Metropolitan Museum of Art & Art Institute of Chicago Open Access archives.",
    });

    const research = await conductHistoricalResearch({
      provider,
      apiKey: aiApiKey,
      analysis,
      userContext,
    });

    await updateJobForSession(jobId, sessionId, {
      research,
      status: "reconstructing_images",
      progress: 52,
      stepLabel: `Synthesizing ${research.hypothesisBriefs.length} visual restoration ${
        research.hypothesisBriefs.length === 1 ? "hypothesis" : "hypotheses"
      }`,
      stepDetail:
        "Preserving observed surviving structure while reconstructing missing portions.",
    });

    const generatedHypotheses: ReconstructionHypothesis[] = [];
    const total = research.hypothesisBriefs.length;

    for (let i = 0; i < total; i++) {
      const brief = research.hypothesisBriefs[i];
      await updateJobForSession(jobId, sessionId, {
        progress: Math.round(54 + ((i + 0.3) / total) * 38),
        stepLabel: `Rendering ${brief.label}: ${brief.title}`,
        stepDetail: brief.subtitle,
      });

      const imgBuf = await generateRestoredArtifactImage({
        provider,
        apiKey: aiApiKey,
        originalImageBuffer: normalizedImageBuffer,
        restorationPrompt: brief.visualPrompt,
      });

      const filename = `${brief.id}.png`;
      const assetUrl = await writeJobAsset(jobId, filename, imgBuf);

      generatedHypotheses.push({
        id: brief.id,
        label: brief.label,
        title: brief.title,
        subtitle: brief.subtitle,
        imageUrl: assetUrl,
        methodologyNote: brief.methodologyNote,
        observedFeaturesPreserved: brief.observedFeaturesPreserved,
        hypothesizedAdditions: brief.hypothesizedAdditions,
        isSpeculative: brief.isSpeculative,
      });

      await updateJobForSession(jobId, sessionId, {
        hypotheses: [...generatedHypotheses],
        progress: Math.round(54 + ((i + 1) / total) * 40),
      });
    }

    await updateJobForSession(jobId, sessionId, {
      status: "awaiting_selection",
      progress: 100,
      stepLabel: "Select a restoration hypothesis for 3D sculpture generation",
      stepDetail:
        "Review archaeological findings and choose your preferred visual reconstruction before sending to Tripo AI.",
      hypotheses: generatedHypotheses,
      selectedHypothesisId: generatedHypotheses[0]?.id,
    });
  } catch (err) {
    const message =
      err instanceof AiProviderError
        ? err.userActionableMessage
        : err instanceof Error
          ? err.message
          : "Unexpected failure during archaeological analysis.";
    await updateJobForSession(jobId, sessionId, {
      status: "failed",
      error: message,
      stepLabel: "Restoration analysis interrupted",
    }).catch(() => {});
  } finally {
    releaseJobLock(jobId);
  }
}
