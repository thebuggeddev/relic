"use client";

import React from "react";
import {
  BookOpen,
  DraftingCompass,
  ExternalLink,
  Layers,
  X,
} from "lucide-react";
import type {
  ReconstructionHypothesis,
  ShowcaseArtifact,
} from "@/types/artifact";

interface ArchivalDossierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: ShowcaseArtifact;
  activeHypothesis: ReconstructionHypothesis;
}

export function ArchivalDossierDrawer({
  isOpen,
  onClose,
  artifact,
  activeHypothesis,
}: ArchivalDossierDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#030f12]/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
    >
      <div className="archival-scroll relative h-full w-full max-w-xl overflow-y-auto border-l border-[#dcb879]/30 bg-[#082127] p-6 sm:p-8 shadow-[-24px_0_64px_rgba(0,0,0,0.75)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#dcb879]/20 pb-5">
          <div>
            <div className="flex items-center gap-2 text-[#dcb879]">
              <BookOpen className="h-4 w-4" />
              <span className="font-sans-ui text-[10.5px] uppercase tracking-[0.22em]">
                {artifact.catalogNumber} · Conservation & Research Dossier
              </span>
            </div>
            <h2
              id="dossier-title"
              className="mt-1.5 font-display text-2xl sm:text-[1.7rem] font-medium leading-tight text-[#f3ede2]"
            >
              {artifact.authenticName}
            </h2>
            <p className="mt-1 font-editorial italic text-base text-[#dcb879]">
              {artifact.dateRange} · {artifact.civilization}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conservation dossier"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dcb879]/30 text-[#c4cfcb] hover:border-[#dcb879] hover:text-[#f3ede2] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Educational Framing Notice */}
        <div className="mt-4 rounded-xl border border-[#dcb879]/25 bg-[#0d2e35]/70 p-3.5">
          <p className="font-editorial text-[14.5px] leading-snug text-[#d9e2df]">
            <strong className="font-semibold text-[#ebd09e]">
              Interpretive Transparency:
            </strong>{" "}
            Relic Reborn separates documented museum observations from
            AI-synthesized missing portions. Reconstructed surfaces represent
            scholarly hypotheses informed by surviving parallels rather than
            academically confirmed physical restorations.
          </p>
        </div>

        {/* Metadata Specification Grid */}
        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#dcb879]/20 bg-[#06191e]/80 p-4 font-sans-ui text-xs">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[#90a5a1]">
              Origin & Civilization
            </dt>
            <dd className="mt-0.5 text-[#f3ede2]">
              {artifact.origin} ({artifact.civilization})
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[#90a5a1]">
              Historical Period
            </dt>
            <dd className="mt-0.5 text-[#f3ede2]">
              {artifact.historicalPeriod} ({artifact.dateRange})
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[#90a5a1]">
              Material & Technique
            </dt>
            <dd className="mt-0.5 text-[#f3ede2]">{artifact.material}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[#90a5a1]">
              Collection & Accession
            </dt>
            <dd className="mt-0.5 text-[#f3ede2]">
              {artifact.museum} ({artifact.accessionNumber})
            </dd>
          </div>
        </dl>

        {/* Purpose & Present Condition */}
        <div className="mt-5 space-y-4">
          <section>
            <h3 className="font-sans-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-[#dcb879]">
              Historical Purpose & Context
            </h3>
            <p className="mt-1.5 font-editorial text-[16px] leading-relaxed text-[#cfd9d5]">
              {artifact.purpose}
            </p>
          </section>

          <section>
            <h3 className="font-sans-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-[#dcb879]">
              Present Surviving Condition
            </h3>
            <p className="mt-1.5 font-editorial text-[16px] leading-relaxed text-[#cfd9d5]">
              {artifact.presentCondition}
            </p>
          </section>
        </div>

        {/* Observed Surviving Portions vs AI-Reconstructed Additions */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="rounded-xl border border-[#dcb879]/25 bg-[#071c21] p-4">
            <div className="flex items-center gap-1.5 text-[#ebd09e]">
              <Layers className="h-3.5 w-3.5" />
              <h4 className="font-sans-ui text-[10.5px] font-semibold uppercase tracking-[0.16em]">
                Observed Surviving Elements
              </h4>
            </div>
            <ul className="mt-2.5 space-y-1.5 font-editorial text-[15px] text-[#cfd9d5]">
              {(activeHypothesis.observedFeaturesPreserved.length > 0
                ? activeHypothesis.observedFeaturesPreserved
                : artifact.observedElements
              ).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#dcb879]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#b87c52]/40 bg-[#0c242a] p-4">
            <div className="flex items-center gap-1.5 text-[#e6b38a]">
              <DraftingCompass className="h-3.5 w-3.5" />
              <h4 className="font-sans-ui text-[10.5px] font-semibold uppercase tracking-[0.16em]">
                AI-Hypothesized Additions
              </h4>
            </div>
            <ul className="mt-2.5 space-y-1.5 font-editorial text-[15px] text-[#cfd9d5]">
              {(activeHypothesis.hypothesizedAdditions.length > 0
                ? activeHypothesis.hypothesizedAdditions
                : artifact.reconstructedAdditions
              ).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#b87c52]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Active Reconstruction Rationale */}
        <section className="mt-5 rounded-xl border border-[#dcb879]/22 bg-[#071c21]/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-sans-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#dcb879]">
              Active Hypothesis: {activeHypothesis.title}
            </h3>
            {activeHypothesis.isSpeculative && (
              <span className="rounded-full border border-amber-400/40 bg-amber-950/60 px-2.5 py-0.5 font-sans-ui text-[10px] uppercase tracking-wider text-amber-200">
                Speculative Interpretation
              </span>
            )}
          </div>
          <p className="mt-1.5 font-editorial text-[15.5px] leading-relaxed text-[#cfd9d5]">
            {activeHypothesis.methodologyNote}
          </p>
          <p className="mt-2 font-editorial text-[15px] leading-relaxed text-[#aebbB7]">
            {artifact.reconstructionEvidence}
          </p>
        </section>

        {/* Comparable Surviving Parallels */}
        {artifact.comparableParallels.length > 0 && (
          <section className="mt-6">
            <h3 className="font-sans-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-[#dcb879]">
              Comparable Museum Parallels
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {artifact.comparableParallels.map((p, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[#dcb879]/18 bg-[#06181d] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm font-medium text-[#f3ede2]">
                        {p.name}
                      </p>
                      <p className="font-sans-ui text-[11px] text-[#9db0ac]">
                        {p.museum} · {p.date}
                        {p.accessionNumber ? ` · ${p.accessionNumber}` : ""}
                      </p>
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 font-sans-ui text-[11px] text-[#dcb879] hover:underline"
                      >
                        Collection <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="mt-1 font-editorial text-sm text-[#c4cfcb]">
                    {p.relevance}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Primary Sources & Media Permissions */}
        <section className="mt-6 border-t border-[#dcb879]/20 pt-5 pb-2">
          <h3 className="font-sans-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-[#dcb879]">
            Museum Sources & Archival References
          </h3>
          <ul className="mt-2.5 space-y-2">
            {artifact.sources.map((src, idx) => (
              <li key={idx}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-lg border border-[#dcb879]/20 bg-[#06181c] px-3.5 py-2.5 transition hover:border-[#dcb879]/60"
                >
                  <div>
                    <p className="font-sans-ui text-xs font-medium text-[#f3ede2] group-hover:text-[#ebd09e]">
                      {src.label}
                    </p>
                    <p className="font-sans-ui text-[11px] text-[#8fa39f]">
                      {src.institution}
                      {src.license ? ` · ${src.license}` : ""}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#dcb879]" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
