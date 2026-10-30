"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type {
  ApiSessionStatus,
  RelicThemePalette,
  ShowcaseArtifact,
} from "@/types/artifact";
import {
  ArchivalBackgroundCanvas,
  RelicBrandMark,
} from "@/components/ArchivalDiagrams";
import { ArchivalDossierDrawer } from "@/components/modals/ArchivalDossierDrawer";
import { UploadRestorationModal } from "@/components/modals/UploadRestorationModal";

const ArtifactStage3D = dynamic(
  () =>
    import("@/components/viewer/ArtifactStage3D").then(
      (mod) => mod.ArtifactStage3D
    ),
  { ssr: false }
);

const DEFAULT_PALETTE: RelicThemePalette = {
  swatch: "#dcb879",
  bgDeep: "#06181c",
  bgMid: "#0c2b31",
  bgGlow: "rgba(25, 78, 86, 0.56)",
  surfaceCard: "rgba(11, 39, 45, 0.72)",
  surfaceSolid: "#092228",
  pedestalTint: "#9eb3b0",
  rimLightColor: "#84b8bd",
};

interface OutgoingBackdropLayer {
  key: number;
  bgDeep: string;
  bgMid: string;
  bgGlow: string;
}

interface ExhibitClientProps {
  initialArtifacts: ShowcaseArtifact[];
}

export function ExhibitClient({ initialArtifacts }: ExhibitClientProps) {
  const [artifacts, setArtifacts] =
    useState<ShowcaseArtifact[]>(initialArtifacts);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>(
    initialArtifacts[0]?.id ?? ""
  );
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>(
    initialArtifacts[0]?.hypotheses[0]?.id ?? ""
  );
  const [pressedKeyDir, setPressedKeyDir] = useState<-1 | 1 | null>(null);

  // Transition choreography state
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [transitionKind, setTransitionKind] = useState<
    "artifact" | "hypothesis"
  >("artifact");
  const [outgoingVariantPlate, setOutgoingVariantPlate] = useState<{
    key: number;
    src: string;
    dir: 1 | -1;
  } | null>(null);
  const variantPlateSeqRef = useRef(0);
  const [compassStep, setCompassStep] = useState<number>(0);
  const [outgoingBackdrop, setOutgoingBackdrop] =
    useState<OutgoingBackdropLayer | null>(null);
  const backdropSeqRef = useRef(0);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [mobileDetailsExpanded, setMobileDetailsExpanded] = useState(false);
  const [lightboxPlate, setLightboxPlate] = useState<{
    src: string;
    caption: string;
  } | null>(null);

  const [sessionStatus, setSessionStatus] = useState<ApiSessionStatus>({
    hasAiKey: false,
    aiProvider: null,
    maskedAiKey: null,
    hasTripoKey: false,
    maskedTripoKey: null,
    ephemeralOnly: true,
  });

  useEffect(() => {
    fetch("/api/credentials", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.hasAiKey === "boolean") {
          setSessionStatus(data as ApiSessionStatus);
        }
      })
      .catch(() => {});
  }, []);

  const activeIndex = useMemo(() => {
    const idx = artifacts.findIndex((a) => a.id === selectedArtifactId);
    return idx >= 0 ? idx : 0;
  }, [artifacts, selectedArtifactId]);

  const activeArtifact = artifacts[activeIndex] ?? artifacts[0];

  const activeHypothesis = useMemo(() => {
    if (!activeArtifact) return undefined;
    return (
      activeArtifact.hypotheses.find((h) => h.id === selectedHypothesisId) ??
      activeArtifact.hypotheses[0]
    );
  }, [activeArtifact, selectedHypothesisId]);

  const activeHypothesisIndex = useMemo(() => {
    if (!activeArtifact || !activeHypothesis) return 0;
    const idx = activeArtifact.hypotheses.findIndex(
      (h) => h.id === activeHypothesis.id
    );
    return idx >= 0 ? idx : 0;
  }, [activeArtifact, activeHypothesis]);

  const selectHypothesis = useCallback(
    (hypId: string) => {
      if (!activeArtifact || hypId === selectedHypothesisId) return;
      const nextIdx = activeArtifact.hypotheses.findIndex((h) => h.id === hypId);
      const dir: 1 | -1 =
        nextIdx >= 0 && nextIdx < activeHypothesisIndex ? -1 : 1;
      if (activeHypothesis?.imageUrl) {
        const seq = ++variantPlateSeqRef.current;
        setOutgoingVariantPlate({
          key: seq,
          src: activeHypothesis.imageUrl,
          dir,
        });
      }
      setTransitionKind("hypothesis");
      setTransitionDirection(dir);
      setSelectedHypothesisId(hypId);
    },
    [
      activeArtifact,
      activeHypothesis?.imageUrl,
      activeHypothesisIndex,
      selectedHypothesisId,
    ]
  );

  const selectArtifactAtIndex = useCallback(
    (targetIdx: number, explicitDelta?: number) => {
      if (artifacts.length === 0) return;
      const normalizedIdx =
        ((targetIdx % artifacts.length) + artifacts.length) % artifacts.length;
      if (normalizedIdx === activeIndex) return;

      const nextArt = artifacts[normalizedIdx];
      if (!nextArt) return;

      const currentTheme = activeArtifact?.themePalette ?? DEFAULT_PALETTE;
      const dir: 1 | -1 =
        explicitDelta !== undefined
          ? explicitDelta >= 0
            ? 1
            : -1
          : normalizedIdx > activeIndex
            ? 1
            : -1;

      const seq = ++backdropSeqRef.current;
      setOutgoingBackdrop({
        key: seq,
        bgDeep: currentTheme.bgDeep,
        bgMid: currentTheme.bgMid,
        bgGlow: currentTheme.bgGlow,
      });

      setOutgoingVariantPlate(null);
      setTransitionKind("artifact");
      setTransitionDirection(dir);
      setCompassStep((s) => s + dir);
      setSelectedArtifactId(nextArt.id);
      setSelectedHypothesisId(nextArt.hypotheses[0]?.id ?? "");
    },
    [activeArtifact, activeIndex, artifacts]
  );

  const stepArtifact = useCallback(
    (delta: number) => {
      selectArtifactAtIndex(activeIndex + delta, delta);
    },
    [activeIndex, selectArtifactAtIndex]
  );

  // Clean up completed backdrop cross-fade overlay after animation finishes
  useEffect(() => {
    if (!outgoingBackdrop) return;
    const timer = window.setTimeout(() => {
      setOutgoingBackdrop((prev) =>
        prev?.key === outgoingBackdrop.key ? null : prev
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [outgoingBackdrop]);

  // Clean up completed outgoing 2D variant plate after vertical transition finishes
  useEffect(() => {
    if (!outgoingVariantPlate) return;
    const timer = window.setTimeout(() => {
      setOutgoingVariantPlate((prev) =>
        prev?.key === outgoingVariantPlate.key ? null : prev
      );
    }, 240);
    return () => window.clearTimeout(timer);
  }, [outgoingVariantPlate]);

  // Preload sibling interpretation & adjacent exhibit images during idle frames for zero-flash transitions
  useEffect(() => {
    if (!activeArtifact || artifacts.length === 0) return;
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const runPreload = () => {
      const urls = new Set<string>();
      for (const h of activeArtifact.hypotheses) {
        if (h.imageUrl) urls.add(h.imageUrl);
      }
      const nextArt = artifacts[(activeIndex + 1) % artifacts.length];
      const prevArt =
        artifacts[(activeIndex - 1 + artifacts.length) % artifacts.length];
      for (const neighbor of [nextArt, prevArt]) {
        if (!neighbor) continue;
        if (neighbor.sketchImageUrl) urls.add(neighbor.sketchImageUrl);
        if (neighbor.originalCutoutUrl) urls.add(neighbor.originalCutoutUrl);
        for (const h of neighbor.hypotheses) {
          if (h.imageUrl) urls.add(h.imageUrl);
        }
      }
      urls.forEach((src) => {
        const img = new window.Image();
        img.decoding = "async";
        img.src = src;
      });
    };

    const timer = window.setTimeout(() => {
      if (typeof win.requestIdleCallback === "function") {
        idleId = win.requestIdleCallback(runPreload, { timeout: 1200 });
      } else {
        runPreload();
      }
    }, 680);

    return () => {
      window.clearTimeout(timer);
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [activeArtifact, activeIndex, artifacts]);

  const preloadModelUrls = useMemo(() => {
    if (artifacts.length === 0) return [];
    const current = artifacts[activeIndex];
    const nextArt = artifacts[(activeIndex + 1) % artifacts.length];
    const prevArt =
      artifacts[(activeIndex - 1 + artifacts.length) % artifacts.length];
    const candidates = [
      ...(current?.hypotheses.map((h) => h.restoredModelUrl) ?? []),
      nextArt?.hypotheses[0]?.restoredModelUrl || nextArt?.restoredModelUrl,
      prevArt?.hypotheses[0]?.restoredModelUrl || prevArt?.restoredModelUrl,
    ].filter((u): u is string => Boolean(u));
    return Array.from(new Set(candidates));
  }, [activeIndex, artifacts]);

  // Keyboard Left/Right relic navigation when no modal or input is active
  useEffect(() => {
    let releaseTimer: number | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isUploadOpen || isDossierOpen || lightboxPlate) {
        if (e.key === "Escape" && lightboxPlate) {
          setLightboxPlate(null);
        }
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        setPressedKeyDir(-1);
        stepArtifact(-1);
        if (releaseTimer) window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => setPressedKeyDir(null), 190);
      } else if (e.key === "ArrowRight") {
        setPressedKeyDir(1);
        stepArtifact(1);
        if (releaseTimer) window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => setPressedKeyDir(null), 190);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (releaseTimer) window.clearTimeout(releaseTimer);
    };
  }, [isUploadOpen, isDossierOpen, lightboxPlate, stepArtifact]);

  const handleMountCompletedUserArtifact = (
    customArtifact: ShowcaseArtifact
  ) => {
    const currentTheme = activeArtifact?.themePalette ?? DEFAULT_PALETTE;
    const seq = ++backdropSeqRef.current;
    setOutgoingBackdrop({
      key: seq,
      bgDeep: currentTheme.bgDeep,
      bgMid: currentTheme.bgMid,
      bgGlow: currentTheme.bgGlow,
    });
    setOutgoingVariantPlate(null);
    setTransitionKind("artifact");
    setTransitionDirection(1);
    setCompassStep((s) => s + 1);
    setArtifacts((prev) => [
      customArtifact,
      ...prev.filter((a) => a.id !== customArtifact.id),
    ]);
    setSelectedArtifactId(customArtifact.id);
    setSelectedHypothesisId(customArtifact.hypotheses[0]?.id ?? "");
  };

  const handleOpenUpload = useCallback(() => {
    setIsUploadOpen(true);
  }, []);

  const handleDownloadGlb = useCallback(() => {
    if (!activeArtifact || !activeHypothesis) return;
    const modelUrl =
      activeHypothesis.restoredModelUrl || activeArtifact.restoredModelUrl;
    if (!modelUrl) return;
    const a = document.createElement("a");
    const downloadHref = modelUrl.startsWith("/api/jobs/")
      ? `${modelUrl}?download=1`
      : modelUrl;
    a.href = downloadHref;
    const slug = activeArtifact.shortTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const variantSuffix =
      activeArtifact.hypotheses.length > 1 ? `-${activeHypothesis.id}` : "";
    a.download = `relic-reborn-${slug || "artifact"}${variantSuffix}.glb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [activeArtifact, activeHypothesis]);

  if (!activeArtifact || !activeHypothesis) return null;

  const theme = activeArtifact.themePalette ?? DEFAULT_PALETTE;
  const activeModelUrl =
    activeHypothesis.restoredModelUrl || activeArtifact.restoredModelUrl;
  const isUserUpload = activeArtifact.id.startsWith("custom-");
  const brokenDisplayUrl =
    activeArtifact.originalCutoutUrl || activeArtifact.originalImageUrl;
  const sketchDisplayUrl =
    activeArtifact.sketchImageUrl || "/showcase/greek-amphora/sketch.webp";
  const dirAttr = transitionDirection >= 0 ? "next" : "prev";

  return (
    <div
      data-dir={dirAttr}
      data-kind={transitionKind}
      data-active-artifact={activeArtifact.id}
      style={{
        backgroundColor: theme.bgDeep,
        backgroundImage: `radial-gradient(ellipse 52% 58% at 50% 48%, ${theme.bgGlow} 0%, ${theme.bgMid} 54%, ${theme.bgDeep} 100%)`,
      }}
      className="relative flex min-h-dvh lg:h-dvh w-full flex-col overflow-x-hidden lg:overflow-hidden"
    >
      {/* Outgoing radial backdrop cross-fade layer for silky GPU-blended pigment transitions */}
      {outgoingBackdrop && (
        <div
          key={outgoingBackdrop.key}
          aria-hidden="true"
          style={{
            backgroundColor: outgoingBackdrop.bgDeep,
            backgroundImage: `radial-gradient(ellipse 52% 58% at 50% 48%, ${outgoingBackdrop.bgGlow} 0%, ${outgoingBackdrop.bgMid} 54%, ${outgoingBackdrop.bgDeep} 100%)`,
          }}
          className="pointer-events-none fixed inset-0 z-0 animate-relic-backdrop-out"
        />
      )}

      {/* Subtle grain overlay */}
      <div className="museum-grain pointer-events-none fixed inset-0 z-[1]" />

      {/* Counter-rotating Geometric Compass & Generated Botanical Pedestal Ornament */}
      <div className="pointer-events-none fixed inset-0 z-[2]">
        <ArchivalBackgroundCanvas rotationStep={compassStep} />
      </div>

      {/* Top Attribution & Invite Offer Banner */}
      <div
        role="region"
        aria-label="3D generation partner announcement"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(5, 8, 9, 0.62) 0%, rgba(220, 184, 121, 0.11) 50%, rgba(5, 8, 9, 0.62) 100%)",
        }}
        className="relative z-30 w-full border-b border-[#dcb879]/24 bg-black/35 px-4 py-1.5 text-center backdrop-blur-md"
      >
        <a
          href="https://developers.tripo3d.ai/?invite=RXAE3VEETG"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 font-sans-ui text-[11px] sm:text-[11.5px] leading-snug text-[#e2dcd0] transition-colors hover:text-[#faf5eb]"
        >
          <span
            aria-hidden="true"
            className="hidden sm:inline-block h-1.5 w-1.5 shrink-0 rotate-45 bg-[#dcb879]/85"
          />
          <span>
            These 3D models are generated using{" "}
            <strong className="font-semibold text-[#ebd09e] underline decoration-[#dcb879]/45 underline-offset-2 transition-colors group-hover:decoration-[#ebd09e]">
              Tripo AI
            </strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#dcb879]/45 bg-[#dcb879]/14 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ebd09e] transition-all duration-200 group-hover:border-[#ebd09e] group-hover:bg-[#dcb879]/24">
            <span>Get 10% Off</span>
            <ExternalLink className="h-2.5 w-2.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>
      </div>

      {/* Clean Minimal Museum Header (Brand Mark Left · Download 3D Right) */}
      <header className="relative z-30 flex items-center justify-between gap-3 px-4 pt-2.5 pb-1 sm:px-8 lg:px-10 xl:px-14">
        <RelicBrandMark />

        <button
          type="button"
          onClick={handleDownloadGlb}
          aria-label={`Download ${activeArtifact.shortTitle} 3D model (.GLB)`}
          title={`Download ${activeArtifact.shortTitle} (${activeHypothesis.label}) as 3D .GLB`}
          style={{ backgroundColor: theme.surfaceCard }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#dcb879]/28 px-3.5 py-1.5 font-sans-ui text-[11px] text-[#d6dfdc] backdrop-blur-md hover:border-[#dcb879] hover:text-[#ebd09e] transition-colors duration-300 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-[#dcb879]" />
          <span>Download 3D</span>
        </button>
      </header>

      {/* Main Single-Screen Desktop Composition / Responsive Mobile-First Stage */}
      <main className="relative z-20 mx-auto grid w-full max-w-[1640px] flex-1 min-h-0 grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-4 px-4 sm:px-8 lg:px-10 xl:px-14 pb-4 lg:pb-4">
        {/* LEFT COLUMN: Title, Interpretations, and Bottom-Left Prev/Next Relic Switcher */}
        <section className="order-1 lg:order-1 lg:col-span-3 relative z-20 flex flex-col justify-between py-1 lg:py-3">
          <div className="my-auto">
            <h1 className="font-display text-[2.3rem] sm:text-[2.95rem] lg:text-[3.25rem] xl:text-[3.95rem] font-normal leading-[1.03] tracking-[-0.015em] text-[#f3ede2]">
              <span className="inline lg:block">Past </span>
              <span className="inline lg:block">Restored </span>
              <span className="inline lg:block">in 3D</span>
            </h1>

            <p className="mt-2.5 lg:mt-3.5 max-w-[295px] font-editorial text-[1.02rem] lg:text-[1.12rem] leading-[1.38] text-[#cdc8be]">
              Upload a damaged artifact and let AI reconstruct it with
              historical accuracy.
            </p>

            {/* Desktop & Tablet Reconstruction Hypotheses Selector */}
            <div className="mt-5 lg:mt-7 hidden sm:block max-w-[322px] xl:max-w-[346px]">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-[#dcb879]" />
                <span className="font-sans-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-[#dcb879]">
                  Interpretations
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#dcb879]/30 to-transparent" />
                <span className="font-editorial italic text-[13px] text-[#bdb7ab]">
                  {activeArtifact.hypotheses.length > 1
                    ? `${activeArtifact.hypotheses.length} variants`
                    : "1 variant"}
                </span>
              </div>

              <div
                className={
                  activeArtifact.hypotheses.length > 1
                    ? "grid grid-cols-3 gap-2.5"
                    : "flex items-center gap-2.5"
                }
                role="radiogroup"
                aria-label="Reconstruction interpretations"
              >
                {activeArtifact.hypotheses.map((hyp, idx) => {
                  const isSelected = hyp.id === activeHypothesis.id;
                  const roman = ["I", "II", "III"][idx] ?? String(idx + 1);
                  return (
                    <button
                      key={`${activeArtifact.id}-${hyp.id}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => selectHypothesis(hyp.id)}
                      title={`${hyp.label}: ${hyp.title}`}
                      style={{
                        animationDelay: `${idx * 45}ms`,
                        ...(isSelected
                          ? {
                              background:
                                "radial-gradient(circle at 50% 58%, rgba(235, 208, 158, 0.28) 0%, rgba(220, 184, 121, 0.09) 55%, rgba(12, 10, 8, 0.82) 100%)",
                            }
                          : { backgroundColor: theme.surfaceCard }),
                      }}
                      className={`animate-relic-panel group relative flex h-[82px] xl:h-[90px] ${
                        activeArtifact.hypotheses.length === 1
                          ? "w-[90px]"
                          : "w-full"
                      } items-center justify-center overflow-hidden rounded-xl border px-2 pt-3.5 pb-1.5 backdrop-blur-sm transition-[border-color,box-shadow,transform,background-color] duration-200 cursor-pointer ${
                        isSelected
                          ? "border-[#ebd09e] shadow-[0_10px_24px_rgba(0,0,0,0.48),0_0_0_1px_rgba(235,208,158,0.3),inset_0_1px_0_rgba(255,246,224,0.2)]"
                          : "border-[#dcb879]/24 hover:border-[#dcb879]/65 hover:-translate-y-0.5"
                      }`}
                    >
                      <span
                        className={`pointer-events-none absolute left-2 top-1.5 font-sans-ui text-[9px] font-semibold tracking-[0.14em] transition-colors ${
                          isSelected
                            ? "text-[#ebd09e]"
                            : "text-[#dcb879]/55 group-hover:text-[#dcb879]"
                        }`}
                      >
                        {roman}
                      </span>

                      {isSelected && (
                        <>
                          <span className="pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rotate-45 bg-[#ebd09e] shadow-[0_0_6px_rgba(235,208,158,0.85)]" />
                          <span className="pointer-events-none absolute inset-x-3 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#ebd09e] to-transparent" />
                        </>
                      )}

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hyp.imageUrl}
                        alt={`${activeArtifact.shortTitle} — ${hyp.title}`}
                        decoding="async"
                        className={`h-full w-full object-contain transition-transform duration-200 ${
                          isSelected
                            ? "opacity-100 scale-[1.03]"
                            : "opacity-85 group-hover:opacity-100 group-hover:scale-105"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div
                key={`caption-${activeArtifact.id}-${activeHypothesis.id}`}
                className="animate-relic-variant-text mt-2.5 border-l border-[#dcb879]/45 pl-3 py-0.5"
              >
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="shrink-0 font-sans-ui text-[9.5px] font-semibold tracking-[0.14em] text-[#ebd09e]">
                    {["I", "II", "III"][activeHypothesisIndex] ??
                      activeHypothesisIndex + 1}
                    .
                  </span>
                  <p className="truncate font-display text-[13.5px] leading-snug text-[#f3ede2]">
                    {activeHypothesis.title}
                  </p>
                </div>
                <p className="mt-0.5 font-editorial italic text-[13px] leading-[1.28] text-[#bcb7ac] line-clamp-1">
                  {activeHypothesis.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Simple Left-Bottom Prev / Next Relic Switcher */}
          <div className="mt-4 lg:mt-0 pt-2">
            {(() => {
              const total = artifacts.length;
              const prevIdx = (activeIndex - 1 + total) % total;
              const nextIdx = (activeIndex + 1) % total;
              const prevArt = artifacts[prevIdx] ?? activeArtifact;
              const nextArt = artifacts[nextIdx] ?? activeArtifact;
              const prevThumb =
                prevArt.hypotheses[0]?.imageUrl ||
                prevArt.originalCutoutUrl ||
                prevArt.originalImageUrl;
              const nextThumb =
                nextArt.hypotheses[0]?.imageUrl ||
                nextArt.originalCutoutUrl ||
                nextArt.originalImageUrl;

              return (
                <nav
                  aria-label="Adjacent exhibits"
                  className="grid w-full sm:max-w-[346px] lg:max-w-none lg:w-[348px] xl:w-[372px] grid-cols-2 gap-2.5"
                >
                  {/* Prev Card */}
                  <button
                    type="button"
                    onClick={() => stepArtifact(-1)}
                    aria-label="Previous relic"
                    title={prevArt.shortTitle}
                    style={{ backgroundColor: theme.surfaceCard }}
                    className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-left backdrop-blur-md shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                      pressedKeyDir === -1
                        ? "border-[#ebd09e]"
                        : "border-[#dcb879]/26 hover:border-[#ebd09e]/75 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-black/35 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={prevThumb}
                        alt=""
                        decoding="async"
                        className="max-h-full max-w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transition duration-200 group-hover:scale-105"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 font-sans-ui text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#dcb879] group-hover:text-[#ebd09e]">
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:-translate-x-0.5"
                        >
                          <path d="M12.5 8H3.5M7 4.5L3.5 8L7 11.5" />
                        </svg>
                        <span>Prev</span>
                      </span>
                      <p className="mt-1 font-display text-[12.5px] xl:text-[13px] leading-[1.2] text-[#ece6d8] group-hover:text-[#faf5eb] line-clamp-2">
                        {prevArt.shortTitle}
                      </p>
                    </div>
                  </button>

                  {/* Next Card */}
                  <button
                    type="button"
                    onClick={() => stepArtifact(1)}
                    aria-label="Next relic"
                    title={nextArt.shortTitle}
                    style={{ backgroundColor: theme.surfaceCard }}
                    className={`group flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-right backdrop-blur-md shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                      pressedKeyDir === 1
                        ? "border-[#ebd09e]"
                        : "border-[#dcb879]/26 hover:border-[#ebd09e]/75 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center justify-end gap-1 font-sans-ui text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#dcb879] group-hover:text-[#ebd09e]">
                        <span>Next</span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                        >
                          <path d="M3.5 8H12.5M9 4.5L12.5 8L9 11.5" />
                        </svg>
                      </span>
                      <p className="mt-1 font-display text-[12.5px] xl:text-[13px] leading-[1.2] text-[#ece6d8] group-hover:text-[#faf5eb] line-clamp-2">
                        {nextArt.shortTitle}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-black/35 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={nextThumb}
                        alt=""
                        decoding="async"
                        className="max-h-full max-w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transition duration-200 group-hover:scale-105"
                      />
                    </div>
                  </button>
                </nav>
              );
            })()}
          </div>
        </section>

        {/* CENTER COLUMN: Full 3D Reconstructed Relic on Chiseled Stone Pedestal */}
        <section className="order-2 lg:order-2 lg:col-span-6 relative z-10 flex flex-col min-h-[430px] sm:min-h-[500px] lg:min-h-0">
          <ArtifactStage3D
            artifactKey={`${activeArtifact.id}-${activeHypothesis.id}`}
            artifactId={activeArtifact.id}
            restoredModelUrl={activeModelUrl}
            transitionDirection={transitionDirection}
            preloadModelUrls={preloadModelUrls}
            initialRotationY={
              activeHypothesis.initialRotationY ??
              activeArtifact.viewerConfig?.initialRotationY ??
              -Math.PI / 2
            }
            defaultScale={
              activeHypothesis.defaultScale ??
              activeArtifact.viewerConfig?.defaultScale ??
              1
            }
            pedestalTint={theme.pedestalTint}
            rimLightColor={theme.rimLightColor}
            onOpenUpload={handleOpenUpload}
          />
        </section>

        {/* RIGHT COLUMN: Top (Sketch + Original Broken), Below (Restored Image), Bottom (Relic Plaque) */}
        <section className="order-3 lg:order-3 lg:col-span-3 relative z-20 flex flex-col justify-between gap-3 py-1 lg:py-2 min-h-0">
          {/* Archival Visual Study Stack */}
          <div className="space-y-2.5">
            {/* Top Row: Generated Archaeological Sketch + Original Broken Historical Relic */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Generated Archaeological Sketch */}
              <button
                key={`sketch-${activeArtifact.id}`}
                type="button"
                onClick={() =>
                  setLightboxPlate({
                    src: sketchDisplayUrl,
                    caption: `${activeArtifact.shortTitle} — Orthographic Archaeological Sketch`,
                  })
                }
                style={{
                  backgroundColor: theme.surfaceCard,
                  animationDelay: "35ms",
                }}
                className="animate-relic-panel relic-plate-sheen group relative flex h-[138px] xl:h-[156px] flex-col items-center justify-between overflow-hidden rounded-xl border border-[#dcb879]/25 p-2 text-left backdrop-blur-sm transition-[border-color,background-color] duration-300 hover:border-[#ebd09e]/70 cursor-pointer"
                title="Click to inspect full-resolution archaeological sketch"
              >
                <span className="self-start font-sans-ui text-[9px] font-medium uppercase tracking-[0.18em] text-[#dcb879]/90">
                  Archival Sketch
                </span>
                <div className="flex flex-1 w-full items-center justify-center min-h-0 py-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sketchDisplayUrl}
                    alt={`${activeArtifact.shortTitle} archaeological technical sketch`}
                    decoding="async"
                    className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105"
                  />
                </div>
              </button>

              {/* 2. Original Broken Historical Image */}
              <button
                key={`broken-${activeArtifact.id}`}
                type="button"
                onClick={() =>
                  setLightboxPlate({
                    src: activeArtifact.originalImageUrl,
                    caption: `${activeArtifact.authenticName} (${activeArtifact.accessionNumber}) — Historical Surviving State`,
                  })
                }
                style={{
                  backgroundColor: theme.surfaceCard,
                  animationDelay: "85ms",
                }}
                className="animate-relic-panel relic-plate-sheen group relative flex h-[138px] xl:h-[156px] flex-col items-center justify-between overflow-hidden rounded-xl border border-[#dcb879]/25 p-2 text-left backdrop-blur-sm transition-[border-color,background-color] duration-300 hover:border-[#ebd09e]/70 cursor-pointer"
                title="Click to inspect original historical broken photograph"
              >
                <span className="self-start font-sans-ui text-[9px] font-medium uppercase tracking-[0.18em] text-[#dcb879]/90">
                  Broken Original
                </span>
                <div className="flex flex-1 w-full items-center justify-center min-h-0 py-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brokenDisplayUrl}
                    alt={`Historical surviving state of ${activeArtifact.shortTitle}`}
                    decoding="async"
                    className="max-h-full max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] transition duration-300 group-hover:scale-105"
                  />
                </div>
              </button>
            </div>

            {/* Below Row: Restored Relic Image */}
            <button
              key={`restored-card-${activeArtifact.id}`}
              type="button"
              onClick={() =>
                setLightboxPlate({
                  src: activeHypothesis.imageUrl,
                  caption: `${activeArtifact.shortTitle} — ${activeHypothesis.title} (AI Restored)`,
                })
              }
              style={{
                backgroundColor: theme.surfaceCard,
                animationDelay: "135ms",
              }}
              className="animate-relic-panel relic-plate-sheen group relative flex h-[142px] xl:h-[162px] w-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-[#dcb879]/28 px-3.5 py-2.5 text-left backdrop-blur-sm transition-[border-color,background-color] duration-300 hover:border-[#ebd09e]/75 cursor-pointer"
              title="Click to inspect full-resolution restored image"
            >
              <div
                key={`restored-meta-${activeArtifact.id}-${activeHypothesis.id}`}
                className="animate-relic-variant-text flex h-full flex-col justify-between py-0.5 min-w-0 flex-1"
              >
                <div>
                  <span className="inline-flex items-center gap-1.5 font-sans-ui text-[9px] font-semibold uppercase tracking-[0.18em] text-[#ebd09e]">
                    <span className="h-1.5 w-1.5 rotate-45 bg-[#dcb879]" />
                    Restored Image ·{" "}
                    {["I", "II", "III"][activeHypothesisIndex] ??
                      activeHypothesisIndex + 1}
                  </span>
                  <p className="mt-1 font-display text-[13.5px] leading-snug text-[#f3ede2] line-clamp-2">
                    {activeHypothesis.title}
                  </p>
                </div>
                <span className="font-editorial italic text-[12.5px] text-[#bdb8ae] line-clamp-2">
                  {activeHypothesis.subtitle}
                </span>
              </div>

              <div className="relative flex h-full w-[112px] xl:w-[126px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/25 p-1.5">
                {outgoingVariantPlate && transitionKind === "hypothesis" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`out-variant-${outgoingVariantPlate.key}`}
                    src={outgoingVariantPlate.src}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    className={`pointer-events-none absolute inset-1.5 m-auto max-h-[calc(100%-12px)] max-w-[calc(100%-12px)] object-contain ${
                      outgoingVariantPlate.dir > 0
                        ? "animate-variant-out-down"
                        : "animate-variant-out-up"
                    }`}
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`restored-img-${activeArtifact.id}-${activeHypothesis.id}`}
                  src={activeHypothesis.imageUrl}
                  alt={`Restored ${activeArtifact.shortTitle}`}
                  decoding="async"
                  className={`${
                    transitionKind === "hypothesis"
                      ? transitionDirection > 0
                        ? "animate-variant-in-top"
                        : "animate-variant-in-bottom"
                      : "animate-relic-image"
                  } max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105`}
                />
              </div>
            </button>
          </div>

          {/* Mobile Compact Hypotheses Switcher */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-sans-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dcb879]">
                <span className="h-1.5 w-1.5 rotate-45 bg-[#dcb879]" />
                Interpretations
              </span>
              <span className="truncate font-editorial italic text-[13px] text-[#d5cfc3]">
                {activeHypothesis.title}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {activeArtifact.hypotheses.map((hyp, idx) => {
                const isSelected = hyp.id === activeHypothesis.id;
                const roman = ["I", "II", "III"][idx] ?? String(idx + 1);
                return (
                  <button
                    key={`mob-${activeArtifact.id}-${hyp.id}`}
                    type="button"
                    onClick={() => selectHypothesis(hyp.id)}
                    style={{
                      animationDelay: `${idx * 40}ms`,
                      ...(isSelected
                        ? {
                            background:
                              "radial-gradient(circle at 50% 58%, rgba(235, 208, 158, 0.28) 0%, rgba(220, 184, 121, 0.09) 55%, rgba(12, 10, 8, 0.82) 100%)",
                          }
                        : { backgroundColor: theme.surfaceCard }),
                    }}
                    className={`animate-relic-panel relative flex h-16 items-center justify-center overflow-hidden rounded-xl border px-1.5 pt-3 pb-1 transition ${
                      isSelected
                        ? "border-[#ebd09e] shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
                        : "border-[#dcb879]/26"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute left-2 top-1 font-sans-ui text-[8.5px] font-semibold tracking-[0.12em] ${
                        isSelected ? "text-[#ebd09e]" : "text-[#dcb879]/55"
                      }`}
                    >
                      {roman}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hyp.imageUrl}
                      alt={hyp.title}
                      className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Artifact Editorial Plaque (Lower-Right) */}
          <div
            key={`plaque-${activeArtifact.id}`}
            className="rounded-xl lg:rounded-none border border-[#dcb879]/20 lg:border-0 bg-black/25 lg:bg-transparent p-4 lg:p-0 lg:pb-1"
          >
            <div
              style={{ animationDelay: "95ms" }}
              className="animate-relic-plaque flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-sans-ui text-[9.5px] uppercase tracking-[0.2em] text-[#dcb879]/85">
                  {activeArtifact.civilization}
                </span>
                <h2 className="mt-0.5 font-display text-[1.55rem] xl:text-[1.82rem] font-normal leading-[1.1] text-[#f3ede2]">
                  {activeArtifact.shortTitle}
                </h2>
                <p className="mt-0.5 font-display text-[1rem] xl:text-[1.1rem] text-[#e5decb]">
                  {activeArtifact.dateRange}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileDetailsExpanded((v) => !v)}
                aria-label="Toggle artifact historical summary"
                className="lg:hidden flex h-8 w-8 items-center justify-center rounded-full border border-[#dcb879]/30 text-[#dcb879]"
              >
                {mobileDetailsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            <div
              style={{ animationDelay: "155ms" }}
              className={`animate-relic-plaque ${
                mobileDetailsExpanded ? "block" : "hidden lg:block"
              } mt-2 space-y-2.5`}
            >
              <p className="font-editorial text-[0.98rem] xl:text-[1.02rem] leading-[1.42] text-[#cac6bc] lg:line-clamp-4">
                {activeArtifact.editorialSummary}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsDossierOpen(true)}
                  className="inline-flex items-center gap-1.5 font-sans-ui text-[10.5px] font-medium uppercase tracking-[0.15em] text-[#ebd09e] hover:text-[#f3ede2] transition cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#dcb879]" />
                  <span>Conservation Dossier →</span>
                </button>

                {!isUserUpload && (
                  <a
                    href={activeArtifact.museumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-sans-ui text-[10px] text-[#a5a29a] hover:text-[#dcb879]"
                  >
                    <span>{activeArtifact.museum}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Lightbox Modal for Inspecting Sketch / Broken Original / Restored Plates */}
      {lightboxPlate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxPlate(null)}
        >
          <div
            style={{ backgroundColor: theme.surfaceSolid }}
            className="animate-relic-modal relative flex max-h-[88dvh] max-w-2xl flex-col items-center rounded-2xl border border-[#dcb879]/35 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPlate(null)}
              aria-label="Close image inspection"
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[#e6dfd2] hover:border-[#dcb879] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPlate.src}
              alt={lightboxPlate.caption}
              className="max-h-[72dvh] w-auto object-contain"
            />
            <p className="mt-3 text-center font-editorial text-base text-[#e6dfd2]">
              {lightboxPlate.caption}
            </p>
          </div>
        </div>
      )}

      {/* Expandable Historical & Conservation Dossier Drawer */}
      <ArchivalDossierDrawer
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        artifact={activeArtifact}
        activeHypothesis={activeHypothesis}
      />

      {/* Unified Digital Conservation Studio: Upload, AI Restoration & Session API Keys */}
      <UploadRestorationModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        sessionStatus={sessionStatus}
        surfaceSolid={theme.surfaceSolid}
        onStatusUpdated={(next) => setSessionStatus(next)}
        onMountCompletedArtifact={handleMountCompletedUserArtifact}
      />
    </div>
  );
}
