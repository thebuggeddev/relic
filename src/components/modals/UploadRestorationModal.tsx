"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cuboid,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  AiProvider,
  ApiSessionStatus,
  RelicThemePalette,
  RestorationJob,
  ShowcaseArtifact,
} from "@/types/artifact";

interface UploadRestorationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionStatus: ApiSessionStatus;
  surfaceSolid?: string;
  focusKeysSignal?: number;
  onStatusUpdated: (status: ApiSessionStatus) => void;
  onMountCompletedArtifact: (artifact: ShowcaseArtifact) => void;
}

/**
 * Samples dominant pigment of an artifact image and converts it into a rich dark museum shade
 * so custom uploaded relics also tint the gallery background while keeping ivory text high-contrast.
 */
async function deriveDarkPaletteFromImage(
  imageUrl: string
): Promise<RelicThemePalette | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.25) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = (r + g + b) / 3;
          if (lum < 18 || lum > 242) continue;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const w = a * (1 + sat / 120);
          rSum += r * w;
          gSum += g * w;
          bSum += b * w;
          weightSum += w;
        }
        if (weightSum <= 0) return resolve(undefined);
        const r = Math.round(rSum / weightSum);
        const g = Math.round(gSum / weightSum);
        const b = Math.round(bSum / weightSum);

        const toHex = (mr: number, mg: number, mb: number) =>
          `#${[mr, mg, mb]
            .map((v) =>
              Math.max(0, Math.min(255, Math.round(v)))
                .toString(16)
                .padStart(2, "0")
            )
            .join("")}`;

        resolve({
          swatch: toHex(r, g, b),
          bgDeep: toHex(r * 0.08, g * 0.08, b * 0.08),
          bgMid: toHex(r * 0.16, g * 0.16, b * 0.16),
          bgGlow: `rgba(${Math.round(r * 0.48)}, ${Math.round(g * 0.48)}, ${Math.round(b * 0.48)}, 0.54)`,
          surfaceCard: `rgba(${Math.round(r * 0.19)}, ${Math.round(g * 0.19)}, ${Math.round(b * 0.19)}, 0.72)`,
          surfaceSolid: toHex(r * 0.13, g * 0.13, b * 0.13),
          pedestalTint: toHex(120 + r * 0.35, 120 + g * 0.35, 120 + b * 0.35),
          rimLightColor: toHex(80 + r * 0.65, 80 + g * 0.65, 80 + b * 0.65),
        });
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = imageUrl;
  });
}

const EMPTY_SESSION_STATUS: ApiSessionStatus = {
  hasAiKey: false,
  aiProvider: null,
  maskedAiKey: null,
  hasTripoKey: false,
  maskedTripoKey: null,
  ephemeralOnly: true,
};

function CornerBrackets({ active = false }: { active?: boolean }) {
  const stroke = active ? "border-[#ebd09e]" : "border-[#dcb879]/40";
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t transition-colors ${stroke}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t transition-colors ${stroke}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-3 left-3 h-3.5 w-3.5 border-b border-l transition-colors ${stroke}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r transition-colors ${stroke}`}
      />
    </>
  );
}

export function UploadRestorationModal({
  isOpen,
  onClose,
  sessionStatus,
  surfaceSolid = "#12100e",
  focusKeysSignal = 0,
  onStatusUpdated,
  onMountCompletedArtifact,
}: UploadRestorationModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const tripoKeyInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusSignalRef = useRef<number>(focusKeysSignal);
  const prevIsOpenRef = useRef<boolean>(false);

  const keysReady = sessionStatus.hasAiKey && sessionStatus.hasTripoKey;

  // Image intake state (zero manual context required — AI infers everything)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Tucked-away Session API Keys drawer state
  const [isKeysExpanded, setIsKeysExpanded] = useState<boolean>(false);
  const [provider, setProvider] = useState<AiProvider>(
    sessionStatus.aiProvider ?? "openai"
  );
  const [aiKey, setAiKey] = useState("");
  const [tripoKey, setTripoKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [showTripoKey, setShowTripoKey] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [isClearingKeys, setIsClearingKeys] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);
  const [tripoBalance, setTripoBalance] = useState<number | null>(null);

  // Active restoration pipeline state
  const [job, setJob] = useState<RestorationJob | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>("");
  const [useMultiview, setUseMultiview] = useState<boolean>(false);
  const [generateAllVariations, setGenerateAllVariations] =
    useState<boolean>(true);
  const [purgeKeysOnFinish, setPurgeKeysOnFinish] = useState<boolean>(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessionStatus.aiProvider) {
      setProvider(sessionStatus.aiProvider);
    }
  }, [sessionStatus.aiProvider]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePickFile = useCallback(
    (file: File | undefined) => {
      setLocalError(null);
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setLocalError("Please select a PNG, JPEG, or WebP photograph.");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setLocalError("Photograph exceeds the 15 MB upload limit.");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [previewUrl]
  );

  const handleClearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Support pasting an image directly from clipboard (Cmd/Ctrl+V)
  useEffect(() => {
    if (!isOpen || job) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const imgFile = Array.from(files).find((f) =>
        ["image/png", "image/jpeg", "image/webp"].includes(f.type)
      );
      if (imgFile) {
        e.preventDefault();
        handlePickFile(imgFile);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handlePickFile, isOpen, job]);

  // Keep modal serene on normal open; auto-open keys drawer only if user clicked header "API Keys"
  useEffect(() => {
    const openedViaKeysButton = focusKeysSignal !== lastFocusSignalRef.current;
    lastFocusSignalRef.current = focusKeysSignal;

    if (isOpen && !prevIsOpenRef.current) {
      setKeyError(null);
      setKeySuccess(null);
      setLocalError(null);
      setIsKeysExpanded(openedViaKeysButton);
    } else if (isOpen && openedViaKeysButton) {
      setIsKeysExpanded(true);
    }

    if (isOpen && openedViaKeysButton) {
      const timer = window.setTimeout(() => {
        if (!sessionStatus.hasAiKey) {
          aiKeyInputRef.current?.focus();
        } else if (!sessionStatus.hasTripoKey) {
          tripoKeyInputRef.current?.focus();
        } else {
          aiKeyInputRef.current?.focus();
        }
      }, 45);
      prevIsOpenRef.current = isOpen;
      return () => window.clearTimeout(timer);
    }

    prevIsOpenRef.current = isOpen;
  }, [
    focusKeysSignal,
    isOpen,
    sessionStatus.hasAiKey,
    sessionStatus.hasTripoKey,
  ]);

  // Escape key closes modal cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !isSavingKeys) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSavingKeys, isSubmitting, onClose]);

  // Poll active restoration job
  useEffect(() => {
    if (!isOpen || !job) return;
    const activeStatuses = new Set([
      "uploaded",
      "analyzing",
      "researching",
      "reconstructing_images",
      "generating_multiview",
      "generating_3d",
      "persisting_assets",
    ]);
    if (!activeStatuses.has(job.status)) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const qs = purgeKeysOnFinish ? "?ephemeralPurge=1" : "";
        const res = await fetch(`/api/jobs/${job.id}${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { job?: RestorationJob };
        if (!cancelled && data.job) {
          setJob(data.job);
          if (data.job.selectedHypothesisId && !selectedHypothesisId) {
            setSelectedHypothesisId(data.job.selectedHypothesisId);
          }
          if (data.job.status === "completed" && purgeKeysOnFinish) {
            onStatusUpdated(EMPTY_SESSION_STATUS);
            setTripoBalance(null);
          }
        }
      } catch {
        // Transient network hiccup; next poll retries
      }
    }, 2200);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    isOpen,
    job,
    purgeKeysOnFinish,
    selectedHypothesisId,
    onStatusUpdated,
  ]);

  const saveCredentialsInternal =
    useCallback(async (): Promise<ApiSessionStatus | null> => {
      setKeyError(null);
      setKeySuccess(null);

      const trimmedAi = aiKey.trim();
      const trimmedTripo = tripoKey.trim();

      if (
        !trimmedAi &&
        !trimmedTripo &&
        provider === sessionStatus.aiProvider
      ) {
        setKeyError(
          "Enter an OpenAI/Gemini or Tripo key to validate and save."
        );
        return null;
      }

      setIsSavingKeys(true);
      try {
        const payload: Record<string, unknown> = {
          aiProvider: provider,
          validate: true,
        };
        if (trimmedAi) payload.aiApiKey = trimmedAi;
        if (trimmedTripo) payload.tripoApiKey = trimmedTripo;

        const res = await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          setKeyError(
            data?.error ||
              "Credential validation failed. Check your keys and try again."
          );
          return null;
        }

        const nextStatus = data as ApiSessionStatus;
        onStatusUpdated(nextStatus);
        setAiKey("");
        setTripoKey("");
        setShowAiKey(false);
        setShowTripoKey(false);

        if (typeof data?.validation?.tripoBalance === "number") {
          setTripoBalance(data.validation.tripoBalance);
        }

        const parts: string[] = [];
        if (data?.validation?.aiModel) {
          parts.push(data.validation.aiModel);
        }
        if (typeof data?.validation?.tripoBalance === "number") {
          parts.push(
            `Tripo v3 (${data.validation.tripoBalance.toFixed(0)} cr)`
          );
        }
        setKeySuccess(
          parts.length > 0
            ? `Verified ${parts.join(" · ")}`
            : "Session keys saved in memory."
        );
        return nextStatus;
      } catch {
        setKeyError("Network error while validating credentials.");
        return null;
      } finally {
        setIsSavingKeys(false);
      }
    }, [aiKey, onStatusUpdated, provider, sessionStatus.aiProvider, tripoKey]);

  if (!isOpen) return null;

  const handleAiKeyInputChange = (val: string) => {
    setAiKey(val);
    if (keyError) setKeyError(null);
    const trimmed = val.trim();
    if (trimmed.startsWith("AIza") && provider !== "gemini") {
      setProvider("gemini");
    } else if (trimmed.startsWith("sk-") && provider !== "openai") {
      setProvider("openai");
    }
  };

  const handleClearKeys = async () => {
    setIsClearingKeys(true);
    setKeyError(null);
    setKeySuccess(null);
    try {
      await fetch("/api/credentials", { method: "DELETE" });
      onStatusUpdated(EMPTY_SESSION_STATUS);
      setTripoBalance(null);
      setAiKey("");
      setTripoKey("");
      setKeySuccess("Session keys cleared from memory.");
    } finally {
      setIsClearingKeys(false);
    }
  };

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    let effectiveStatus = sessionStatus;

    if (aiKey.trim() || tripoKey.trim()) {
      const saved = await saveCredentialsInternal();
      if (!saved) {
        setIsKeysExpanded(true);
        return;
      }
      effectiveStatus = saved;
    }

    if (!effectiveStatus.hasAiKey) {
      setIsKeysExpanded(true);
      setKeyError("Add an OpenAI or Gemini API key to start restoration.");
      window.setTimeout(() => aiKeyInputRef.current?.focus(), 35);
      return;
    }

    if (!selectedFile) {
      setLocalError("Drop or select a photograph of your artifact first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "MISSING_AI_KEY") {
          setIsKeysExpanded(true);
          window.setTimeout(() => aiKeyInputRef.current?.focus(), 35);
        }
        setLocalError(data?.error || "Failed starting artifact analysis.");
        return;
      }
      setJob(data.job as RestorationJob);
      setSelectedHypothesisId("");
      setIsKeysExpanded(false);
    } catch {
      setLocalError("Network error while uploading artifact photograph.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateTripo3D = async () => {
    if (!job) return;
    setLocalError(null);

    let effectiveStatus = sessionStatus;
    if (aiKey.trim() || tripoKey.trim()) {
      const saved = await saveCredentialsInternal();
      if (!saved) {
        setIsKeysExpanded(true);
        return;
      }
      effectiveStatus = saved;
    }

    if (!effectiveStatus.hasTripoKey) {
      setIsKeysExpanded(true);
      setKeyError("Add your Tripo AI key to generate the 3D mesh.");
      window.setTimeout(() => tripoKeyInputRef.current?.focus(), 35);
      return;
    }

    const chosenId =
      selectedHypothesisId ||
      job.selectedHypothesisId ||
      job.hypotheses?.[0]?.id;

    if (!chosenId) {
      setLocalError("Select a reconstruction hypothesis first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/generate-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesisId: chosenId,
          useMultiview,
          generateAllVariations,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "MISSING_TRIPO_KEY") {
          setIsKeysExpanded(true);
          window.setTimeout(() => tripoKeyInputRef.current?.focus(), 35);
        }
        setLocalError(data?.error || "Failed starting Tripo 3D generation.");
        return;
      }
      setJob(data.job as RestorationJob);
      setIsKeysExpanded(false);
    } catch {
      setLocalError("Network error contacting Tripo 3D endpoint.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspectOnMainStage = async () => {
    if (!job || !job.restoredModelUrl || !job.analysis || !job.research) return;
    const targetHypId =
      selectedHypothesisId ||
      job.selectedHypothesisId ||
      job.hypotheses?.[0]?.id;
    const chosenHyp =
      job.hypotheses?.find((h) => h.id === targetHypId) ??
      job.hypotheses?.[0];

    const sampledTheme = await deriveDarkPaletteFromImage(
      chosenHyp?.imageUrl || job.uploadedImageUrl
    );

    const mappedHypotheses = (job.hypotheses ?? []).map((h) => ({
      ...h,
      restoredModelUrl:
        h.restoredModelUrl ??
        (h.id === job.selectedHypothesisId ? job.restoredModelUrl : undefined),
    }));

    const orderedHypotheses =
      chosenHyp?.restoredModelUrl && mappedHypotheses.length > 1
        ? [
            ...mappedHypotheses.filter((h) => h.id === chosenHyp.id),
            ...mappedHypotheses.filter((h) => h.id !== chosenHyp.id),
          ]
        : mappedHypotheses;

    const customArtifact: ShowcaseArtifact = {
      id: `custom-${job.id}`,
      catalogNumber: "VISITOR RESTORATION",
      shortTitle: job.analysis.objectType || "Custom Relic",
      authenticName: `${job.analysis.objectType} (AI Reconstructed)`,
      accessionNumber: "Session Upload",
      dateRange: job.analysis.potentialPeriod,
      historicalPeriod: job.analysis.potentialPeriod,
      civilization: job.analysis.potentialCivilization,
      origin: job.analysis.potentialCivilization,
      material: job.analysis.probableMaterial,
      museum: "Visitor Digital Conservation Session",
      museumUrl: job.uploadedImageUrl,
      license: "Session-Scoped Ephemeral Upload",
      editorialSummary: job.research.researchSummary,
      purpose: job.analysis.conservationObservations,
      presentCondition: `Missing or damaged sections identified: ${job.analysis.missingOrDamagedSections.join(
        "; "
      )}.`,
      observedElements: job.analysis.survivingElements,
      reconstructedAdditions:
        chosenHyp?.hypothesizedAdditions ??
        job.analysis.missingOrDamagedSections,
      reconstructionEvidence: [
        ...job.research.supportedFindings,
        ...job.research.documentedReconstructionMethods,
      ].join(" "),
      comparableParallels: job.research.comparableObjects,
      originalImageUrl: job.uploadedImageUrl,
      originalCutoutUrl: job.uploadedImageUrl,
      sketchImageUrl: "/showcase/greek-amphora/sketch.webp",
      fragmentedVisualUrl: job.uploadedImageUrl,
      fragmentedIsAiEstimated: true,
      restoredModelUrl: chosenHyp?.restoredModelUrl || job.restoredModelUrl,
      themePalette: sampledTheme,
      hypotheses: orderedHypotheses,
      diagramType: "amphora",
      sources: job.research.comparableObjects
        .filter((c) => Boolean(c.url))
        .map((c) => ({
          label: c.name,
          institution: c.museum,
          url: c.url!,
          license: "Open Access Parallel",
        })),
    };

    onMountCompletedArtifact(customArtifact);
    onClose();
  };

  const resetWorkflow = () => {
    setJob(null);
    setLocalError(null);
    setSelectedHypothesisId("");
  };

  const activeChoiceId =
    selectedHypothesisId ||
    job?.selectedHypothesisId ||
    job?.hypotheses?.[0]?.id ||
    "";

  const selectedHypothesisObj =
    job?.hypotheses?.find((h) => h.id === activeChoiceId) ??
    job?.hypotheses?.[0];

  const hasHypotheses = Boolean(job?.hypotheses && job.hypotheses.length > 0);
  const hasAnySavedKey = sessionStatus.hasAiKey || sessionStatus.hasTripoKey;
  const hasPendingKeyEdits =
    aiKey.trim().length > 0 ||
    tripoKey.trim().length > 0 ||
    (sessionStatus.hasAiKey && provider !== sessionStatus.aiProvider);

  const keyPillLabel = keysReady
    ? "Keys Ready"
    : hasAnySavedKey
      ? "1/2 Keys"
      : "Set Keys";

  const isJobRunning = Boolean(
    job &&
      job.status !== "awaiting_selection" &&
      job.status !== "completed" &&
      job.status !== "failed"
  );

  const renderInlineKeysPanel = () => (
    <div
      data-testid="inline-api-keys-panel"
      className="rounded-xl border border-[#dcb879]/28 bg-black/35 p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#dcb879]" />
          <span className="font-sans-ui text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#ebd09e]">
            Session API Keys
          </span>
        </div>

        <div
          role="group"
          aria-label="Vision and image AI provider"
          className="inline-flex shrink-0 rounded-lg border border-white/14 bg-black/50 p-0.5 font-sans-ui text-[11px]"
        >
          <button
            type="button"
            onClick={() => {
              setProvider("openai");
              setKeyError(null);
            }}
            className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
              provider === "openai"
                ? "bg-[#dcb879]/24 text-[#f3ede2] font-semibold shadow-[inset_0_0_0_1px_rgba(220,184,121,0.48)]"
                : "text-[#9ab0ac] hover:text-[#f3ede2]"
            }`}
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => {
              setProvider("gemini");
              setKeyError(null);
            }}
            className={`rounded-md px-2.5 py-0.5 transition cursor-pointer ${
              provider === "gemini"
                ? "bg-[#dcb879]/24 text-[#f3ede2] font-semibold shadow-[inset_0_0_0_1px_rgba(220,184,121,0.48)]"
                : "text-[#9ab0ac] hover:text-[#f3ede2]"
            }`}
          >
            Gemini
          </button>
        </div>
      </div>

      {/* Input 1: Vision & Image Restoration AI Key */}
      <div>
        <div className="flex items-center justify-between gap-2 font-sans-ui text-[11px]">
          <label
            htmlFor="ai-api-key-input"
            className="flex items-center gap-1.5 text-[#dce5e2]"
          >
            <span>
              {provider === "openai" ? "OpenAI Key" : "Gemini Key"}
            </span>
            {sessionStatus.hasAiKey &&
              sessionStatus.aiProvider === provider && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {sessionStatus.maskedAiKey}
                </span>
              )}
          </label>
          <a
            href={
              provider === "openai"
                ? "https://platform.openai.com/api-keys"
                : "https://aistudio.google.com/apikey"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 text-[10.5px] text-[#dcb879] hover:text-[#ebd09e] hover:underline"
          >
            Get key <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <div className="relative mt-1">
          <input
            ref={aiKeyInputRef}
            id="ai-api-key-input"
            type={showAiKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={aiKey}
            onChange={(e) => handleAiKeyInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveCredentialsInternal();
              }
            }}
            placeholder={
              sessionStatus.hasAiKey && sessionStatus.aiProvider === provider
                ? `Saved (${sessionStatus.maskedAiKey}) · enter new to replace`
                : provider === "openai"
                  ? "sk-proj-..."
                  : "AIzaSy..."
            }
            className="w-full rounded-lg border border-white/15 bg-black/45 pl-3 pr-9 py-2 font-sans-ui text-xs text-[#f3ede2] placeholder-[#6f827e] focus:border-[#dcb879] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowAiKey((v) => !v)}
            aria-label={showAiKey ? "Hide AI API key" : "Show AI API key"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8ba09c] hover:text-[#ebd09e] cursor-pointer"
          >
            {showAiKey ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Input 2: Tripo 3D Key */}
      <div>
        <div className="flex items-center justify-between gap-2 font-sans-ui text-[11px]">
          <label
            htmlFor="tripo-api-key-input"
            className="flex items-center gap-1.5 text-[#dce5e2]"
          >
            <span>Tripo 3D Key</span>
            {sessionStatus.hasTripoKey && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {sessionStatus.maskedTripoKey}
                {tripoBalance !== null
                  ? ` · ${tripoBalance.toFixed(0)} cr`
                  : ""}
              </span>
            )}
          </label>
          <a
            href="https://developers.tripo3d.ai/en"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 text-[10.5px] text-[#dcb879] hover:text-[#ebd09e] hover:underline"
          >
            Get key <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <div className="relative mt-1">
          <input
            ref={tripoKeyInputRef}
            id="tripo-api-key-input"
            type={showTripoKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={tripoKey}
            onChange={(e) => {
              setTripoKey(e.target.value);
              if (keyError) setKeyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveCredentialsInternal();
              }
            }}
            placeholder={
              sessionStatus.hasTripoKey
                ? `Saved (${sessionStatus.maskedTripoKey}) · enter new to replace`
                : "tsk_..."
            }
            className="w-full rounded-lg border border-white/15 bg-black/45 pl-3 pr-9 py-2 font-sans-ui text-xs text-[#f3ede2] placeholder-[#6f827e] focus:border-[#dcb879] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowTripoKey((v) => !v)}
            aria-label={
              showTripoKey ? "Hide Tripo API key" : "Show Tripo API key"
            }
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8ba09c] hover:text-[#ebd09e] cursor-pointer"
          >
            {showTripoKey ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {keyError && (
        <div
          role="alert"
          className="rounded-lg border border-red-400/35 bg-red-950/50 px-3 py-1.5 font-sans-ui text-[11px] text-red-200"
        >
          {keyError}
        </div>
      )}

      {keySuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-400/35 bg-emerald-950/45 px-3 py-1.5 font-sans-ui text-[11px] text-emerald-200"
        >
          {keySuccess}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 min-w-0 font-sans-ui text-[10.5px] text-[#94a8a4]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#dcb879]" />
          <span className="truncate">Encrypted in session RAM only</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {hasAnySavedKey && (
            <button
              type="button"
              onClick={handleClearKeys}
              disabled={isClearingKeys || isSavingKeys}
              className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 font-sans-ui text-[10.5px] text-red-200/90 hover:bg-red-950/50 disabled:opacity-50 cursor-pointer"
            >
              {isClearingKeys ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Trash2 className="h-2.5 w-2.5" />
              )}
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void saveCredentialsInternal()}
            disabled={isSavingKeys || isClearingKeys}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 font-sans-ui text-[11px] font-semibold transition cursor-pointer disabled:opacity-50 ${
              hasPendingKeyEdits
                ? "border-[#ebd09e]/85 bg-[#dcb879]/28 text-[#f7efe0] hover:bg-[#dcb879]/38"
                : "border-[#dcb879]/38 bg-white/[0.05] text-[#e6d0a1] hover:border-[#dcb879]/75"
            }`}
          >
            {isSavingKeys && <Loader2 className="h-3 w-3 animate-spin" />}
            <span>{isSavingKeys ? "Verifying..." : "Save Keys"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/76 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isSavingKeys) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: surfaceSolid,
          backgroundImage:
            "radial-gradient(ellipse 75% 52% at 50% 0%, rgba(220, 184, 121, 0.09) 0%, transparent 72%)",
        }}
        className={`animate-relic-modal archival-scroll relative max-h-[90dvh] w-full ${
          hasHypotheses && !isJobRunning ? "max-w-[640px]" : "max-w-[550px]"
        } overflow-y-auto rounded-2xl border border-[#dcb879]/32 p-6 sm:p-7 shadow-[0_32px_90px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,246,224,0.12)] transition-[max-width] duration-300`}
      >
        {/* Top Hairline Gold Glint */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#ebd09e]/55 to-transparent"
        />

        {/* Minimal Header */}
        <header>
          <div className="flex items-center justify-between gap-3">
            <h2
              id="upload-modal-title"
              className="min-w-0 font-display text-[1.45rem] sm:text-[1.72rem] font-normal leading-tight text-[#f3ede2]"
            >
              Restore Your Artifact
            </h2>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsKeysExpanded((v) => !v)}
                aria-expanded={isKeysExpanded}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans-ui text-[11px] font-medium transition cursor-pointer ${
                  isKeysExpanded
                    ? "border-[#dcb879]/75 bg-[#dcb879]/18 text-[#f3ede2]"
                    : "border-[#dcb879]/30 bg-black/28 text-[#e6d0a1] hover:border-[#dcb879]/70"
                }`}
                title="Configure session OpenAI / Gemini & Tripo API keys"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#dcb879]" />
                <span>{keyPillLabel}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    keysReady ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                {isKeysExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 opacity-80" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close upload workflow"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/14 bg-black/25 text-[#c2cfcb] hover:border-[#dcb879]/60 hover:text-[#f3ede2] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="mt-1.5 font-editorial text-[15px] leading-snug text-[#bcc8c4]">
            Drop a photograph of a damaged relic — AI handles attribution &amp;
            3D restoration.
          </p>
        </header>

        {/* STAGE A: Pure Minimal Image Dropzone + Primary CTA */}
        {!job && (
          <form onSubmit={handleStartAnalysis} className="mt-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handlePickFile(e.target.files?.[0])}
              className="hidden"
            />

            {isKeysExpanded && renderInlineKeysPanel()}

            {previewUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handlePickFile(e.dataTransfer.files?.[0]);
                }}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 48%, rgba(220, 184, 121, 0.14) 0%, rgba(0, 0, 0, 0.5) 78%)",
                }}
                className={`relative flex min-h-[256px] flex-col items-center justify-center overflow-hidden rounded-2xl border p-5 transition ${
                  isDragOver
                    ? "border-[#ebd09e] bg-[#dcb879]/12"
                    : "border-[#dcb879]/38 bg-black/36"
                }`}
              >
                <CornerBrackets active={isDragOver} />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected artifact preview"
                  className="max-h-[188px] max-w-full rounded-lg object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.68)]"
                />

                <div className="mt-3.5 flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-black/55 py-1 pl-3.5 pr-1.5 backdrop-blur-sm">
                  <span className="max-w-[200px] sm:max-w-[260px] truncate font-sans-ui text-[11.5px] text-[#b4c4c0]">
                    {selectedFile?.name}
                    {selectedFile
                      ? ` · ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : ""}
                  </span>
                  <span aria-hidden="true" className="mx-0.5 h-3 w-px bg-white/15" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-full px-2.5 py-0.5 font-sans-ui text-[11px] font-medium text-[#ebd09e] hover:bg-[#dcb879]/20 transition cursor-pointer"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    aria-label="Remove selected photograph"
                    title="Remove photograph"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9eb0ac] hover:bg-red-950/60 hover:text-red-200 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (
                    !e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handlePickFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 46%, rgba(220, 184, 121, 0.09) 0%, rgba(0, 0, 0, 0.3) 76%)",
                }}
                className={`group relative flex min-h-[256px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-6 text-center transition duration-200 focus:outline-none focus:border-[#ebd09e] ${
                  isDragOver
                    ? "border-[#ebd09e] bg-[#dcb879]/14 scale-[1.005]"
                    : "border-[#dcb879]/36 bg-black/22 hover:border-[#ebd09e]/80 hover:bg-white/[0.035]"
                }`}
              >
                <CornerBrackets active={isDragOver} />

                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border border-[#dcb879]/40 bg-[#dcb879]/12 text-[#ebd09e] shadow-[0_0_26px_rgba(220,184,121,0.16)] transition duration-200 ${
                    isDragOver ? "scale-110" : "group-hover:scale-105"
                  }`}
                >
                  <Upload className="h-5 w-5" />
                </div>

                <p className="mt-4 font-display text-[1.2rem] leading-snug text-[#f3ede2]">
                  {isDragOver ? (
                    "Release to drop photograph"
                  ) : (
                    <>
                      Drop artifact photo or{" "}
                      <span className="text-[#ebd09e] underline decoration-[#dcb879]/60 underline-offset-4 group-hover:decoration-[#ebd09e]">
                        browse
                      </span>
                    </>
                  )}
                </p>

                <p className="mt-1.5 font-sans-ui text-xs text-[#93a7a3]">
                  PNG, JPG, or WebP · Max 15 MB · Paste with ⌘V
                </p>
              </div>
            )}

            {localError && (
              <div
                role="alert"
                className="rounded-xl border border-red-400/38 bg-red-950/50 px-3.5 py-2.5 font-sans-ui text-xs text-red-200"
              >
                {localError}
              </div>
            )}

            <div className="pt-0.5">
              <button
                type="submit"
                disabled={isSubmitting || isSavingKeys || !selectedFile}
                className="btn-gold-pill flex w-full items-center justify-center gap-2 rounded-full py-3.5 px-6 font-sans-ui text-[13.5px] font-semibold cursor-pointer disabled:opacity-45"
              >
                {isSubmitting || isSavingKeys ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Box className="h-4 w-4" />
                )}
                <span>
                  {isSavingKeys
                    ? "Verifying Keys..."
                    : isSubmitting
                      ? "Uploading Photograph..."
                      : "Reconstruct Artifact in 3D"}
                </span>
              </button>

              {!keysReady && !isKeysExpanded && (
                <p className="mt-2.5 text-center font-sans-ui text-[11.5px] text-[#96aaa6]">
                  Requires session{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsKeysExpanded(true);
                      window.setTimeout(() => {
                        if (!sessionStatus.hasAiKey) {
                          aiKeyInputRef.current?.focus();
                        } else {
                          tripoKeyInputRef.current?.focus();
                        }
                      }, 35);
                    }}
                    className="text-[#ebd09e] underline underline-offset-2 hover:text-[#f3ede2] cursor-pointer"
                  >
                    OpenAI / Gemini &amp; Tripo API keys
                  </button>
                </p>
              )}
            </div>
          </form>
        )}

        {/* STAGE B: Minimal Automated AI Pipeline & Variant Selection */}
        {job && (
          <div className="mt-5 space-y-4">
            {isKeysExpanded && renderInlineKeysPanel()}

            {/* Error Banner */}
            {(job.status === "failed" || localError) && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3"
              >
                <p className="font-sans-ui text-xs text-red-100">
                  {localError || job.error}
                </p>
                <button
                  type="button"
                  onClick={hasHypotheses ? handleGenerateTripo3D : resetWorkflow}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#dcb879] px-3.5 py-1.5 font-sans-ui text-[11px] font-semibold text-[#21180b] cursor-pointer"
                >
                  {hasHypotheses ? (
                    <>
                      <RefreshCw className="h-3 w-3" /> Retry
                    </>
                  ) : (
                    "Start Over"
                  )}
                </button>
              </div>
            )}

            {/* Calm Centered Live AI Progress Stage */}
            {isJobRunning && (
              <div
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 42%, rgba(220, 184, 121, 0.13) 0%, rgba(0, 0, 0, 0.45) 78%)",
                }}
                className="relative flex flex-col items-center rounded-2xl border border-[#dcb879]/30 bg-black/32 p-6 text-center"
              >
                <CornerBrackets active />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedHypothesisObj?.imageUrl || job.uploadedImageUrl}
                  alt="Artifact in conservation"
                  className="max-h-[168px] max-w-full rounded-lg object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.65)]"
                />

                <div className="mt-4 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#ebd09e]" />
                  <p className="font-display text-base text-[#f3ede2]">
                    {job.stepLabel}
                  </p>
                </div>

                {job.analysis && (
                  <p className="mt-1 font-editorial italic text-[14.5px] text-[#c7d2ce]">
                    {job.analysis.objectType} ·{" "}
                    {job.analysis.potentialCivilization} (
                    {job.analysis.potentialPeriod})
                  </p>
                )}

                <div className="mt-4 w-full max-w-[380px]">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/55">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#b87c52] via-[#dcb879] to-[#ebd09e] transition-all duration-500"
                      style={{ width: `${Math.max(8, job.progress)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 font-sans-ui text-[11px] text-[#94a8a4]">
                    {job.progress}% complete
                  </p>
                </div>
              </div>
            )}

            {/* Clean Visual Hypothesis Selection & Completion */}
            {!isJobRunning && (
              <>
                {job.analysis && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] text-[#f3ede2]">
                        {job.analysis.objectType}
                      </p>
                      <p className="truncate font-sans-ui text-[11px] text-[#9ab0ac]">
                        {job.analysis.potentialCivilization} ·{" "}
                        {job.analysis.potentialPeriod}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#dcb879]/35 bg-[#dcb879]/10 px-2.5 py-0.5 font-sans-ui text-[10px] uppercase tracking-wider text-[#ebd09e]">
                      AI Identified
                    </span>
                  </div>
                )}

                {job.hypotheses && job.hypotheses.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {job.hypotheses.map((hyp, i) => {
                      const isSelected = activeChoiceId === hyp.id;
                      const hasMesh = Boolean(
                        hyp.restoredModelUrl ||
                          (job.status === "completed" &&
                            hyp.id === job.selectedHypothesisId &&
                            job.restoredModelUrl)
                      );
                      return (
                        <button
                          key={hyp.id}
                          type="button"
                          onClick={() => setSelectedHypothesisId(hyp.id)}
                          className={`group flex flex-col rounded-xl border p-2.5 text-left transition cursor-pointer ${
                            isSelected
                              ? "border-[#ebd09e] bg-[#dcb879]/14 shadow-[0_10px_24px_rgba(0,0,0,0.42),0_0_0_1px_rgba(235,208,158,0.3)]"
                              : "border-white/12 bg-white/[0.025] hover:border-[#dcb879]/55"
                          }`}
                        >
                          <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-black/45 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={hyp.imageUrl}
                              alt={hyp.title}
                              className="max-h-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)] transition duration-200 group-hover:scale-105"
                            />
                            <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-sans-ui text-[9px] font-semibold text-[#ebd09e]">
                              {["I", "II", "III"][i] ?? i + 1}
                            </span>
                            {hasMesh ? (
                              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/80 px-2 py-0.5 font-sans-ui text-[9px] font-semibold text-emerald-300">
                                <Cuboid className="h-2.5 w-2.5" /> 3D
                              </span>
                            ) : (
                              isSelected && (
                                <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-[#ebd09e]" />
                              )
                            )}
                          </div>
                          <p className="mt-2 truncate font-display text-[13.5px] text-[#f3ede2]">
                            {hyp.title}
                          </p>
                          <p className="truncate font-editorial italic text-[12.5px] text-[#b4c2be]">
                            {hyp.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {job.status === "awaiting_selection" && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-sans-ui text-[11.5px] text-[#b4c2be]">
                      {(job.hypotheses?.length ?? 0) > 1 && (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={generateAllVariations}
                            onChange={(e) =>
                              setGenerateAllVariations(e.target.checked)
                            }
                            className="accent-[#dcb879]"
                          />
                          <span>
                            Generate 3D for all {job.hypotheses?.length} variants
                          </span>
                        </label>
                      )}
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useMultiview}
                          onChange={(e) => setUseMultiview(e.target.checked)}
                          className="accent-[#dcb879]"
                        />
                        <span>360° Multiview</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#8ea29e]">
                        <input
                          type="checkbox"
                          checked={purgeKeysOnFinish}
                          onChange={(e) =>
                            setPurgeKeysOnFinish(e.target.checked)
                          }
                          className="accent-[#dcb879]"
                        />
                        <span>Auto-clear keys</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={resetWorkflow}
                        className="rounded-full border border-white/15 px-4 py-3 font-sans-ui text-xs text-[#b8c6c2] hover:text-[#f3ede2] transition cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateTripo3D}
                        disabled={isSubmitting || isSavingKeys}
                        className="btn-gold-pill flex flex-1 items-center justify-center gap-2 rounded-full py-3 px-5 font-sans-ui text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting || isSavingKeys ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Cuboid className="h-4 w-4" />
                        )}
                        <span>
                          {generateAllVariations &&
                          (job.hypotheses?.length ?? 0) > 1
                            ? `Generate All ${job.hypotheses?.length} 3D Models`
                            : "Generate 3D Model"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {job.status === "completed" && job.restoredModelUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={resetWorkflow}
                      className="rounded-full border border-white/15 px-4 py-2.5 font-sans-ui text-xs text-[#b8c6c2] hover:text-[#f3ede2] cursor-pointer"
                    >
                      Upload Another
                    </button>

                    <div className="flex items-center gap-2">
                      <a
                        href={`${
                          selectedHypothesisObj?.restoredModelUrl ||
                          job.restoredModelUrl
                        }?download=1`}
                        download
                        aria-label="Download GLB"
                        title="Download .GLB 3D model"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#dcb879]/38 bg-black/30 px-4 py-2.5 font-sans-ui text-xs font-medium text-[#ebd09e] hover:bg-[#dcb879]/16 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>.GLB</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleInspectOnMainStage}
                        className="btn-gold-pill inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-sans-ui text-[13px] font-semibold cursor-pointer"
                      >
                        <span>View on 3D Pedestal →</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
