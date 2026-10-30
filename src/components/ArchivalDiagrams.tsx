"use client";

import React from "react";

export function RelicBrandMark() {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        width="42"
        height="36"
        viewBox="0 0 44 38"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M2 12V2H14"
          stroke="rgba(220,184,121,0.32)"
          strokeWidth="0.8"
        />
        <path
          d="M7 19H13M10 16V22"
          stroke="rgba(220,184,121,0.62)"
          strokeWidth="0.9"
        />
        <g stroke="#cbb07c" strokeWidth="1.15" fill="rgba(203,176,124,0.10)">
          <rect x="18" y="6" width="22" height="3.2" rx="0.6" />
          <path d="M19.5 9.5C18 9.5 17 10.7 17 12C17 13.3 18.1 14.2 19.5 14.2H21V28.5H18.5V31.5H39.5V28.5H37V14.2H38.5C39.9 14.2 41 13.3 41 12C41 10.7 40 9.5 38.5 9.5H19.5Z" />
          <line x1="24.5" y1="13.5" x2="24.5" y2="28.5" strokeWidth="0.95" />
          <line x1="29" y1="13.5" x2="29" y2="28.5" strokeWidth="0.95" />
          <line x1="33.5" y1="13.5" x2="33.5" y2="28.5" strokeWidth="0.95" />
          <rect x="16.5" y="31.5" width="25" height="2.8" rx="0.5" />
        </g>
      </svg>
      <span className="font-display text-[1.2rem] tracking-[0.01em] text-[#f3ede2] font-medium">
        Relic Reborn
      </span>
    </div>
  );
}

export function ArchivalBackgroundCanvas({
  rotationStep = 0,
}: {
  rotationStep?: number;
} = {}) {
  const outerDeg = rotationStep * 18;
  const innerDeg = -rotationStep * 26;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Clean geometric compass rings & architectural datum hairlines */}
      <svg
        className="absolute inset-0 h-full w-full opacity-80"
        viewBox="0 0 1600 940"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="rgba(220,184,121,0.18)" strokeWidth="0.8" fill="none">
          {/* Precision counter-rotating compass rings centered behind the 3D stage */}
          <g transform="translate(785 448)">
            <g
              style={{
                transform: `rotate(${outerDeg}deg)`,
                transition: "transform 920ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <circle
                cx="0"
                cy="0"
                r="348"
                stroke="rgba(220,184,121,0.24)"
              />
              {/* Subtle compass vernier ticks */}
              <line x1="0" y1="-354" x2="0" y2="-341" stroke="rgba(220,184,121,0.32)" />
              <line x1="0" y1="341" x2="0" y2="354" stroke="rgba(220,184,121,0.32)" />
              <line x1="-354" y1="0" x2="-341" y2="0" stroke="rgba(220,184,121,0.28)" />
              <line x1="341" y1="0" x2="354" y2="0" stroke="rgba(220,184,121,0.28)" />
              <circle cx="246" cy="-246" r="2.2" fill="rgba(220,184,121,0.38)" />
              <circle cx="-246" cy="246" r="2.2" fill="rgba(220,184,121,0.38)" />
            </g>

            <g
              style={{
                transform: `rotate(${innerDeg}deg)`,
                transition: "transform 1080ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <circle
                cx="0"
                cy="0"
                r="298"
                stroke="rgba(220,184,121,0.12)"
                strokeDasharray="3 6"
              />
            </g>
          </g>

          <line
            x1="395"
            y1="448"
            x2="448"
            y2="448"
            stroke="rgba(220,184,121,0.24)"
          />
          <line
            x1="1122"
            y1="448"
            x2="1175"
            y2="448"
            stroke="rgba(220,184,121,0.24)"
          />
          <circle cx="1132" cy="448" r="2.6" fill="rgba(220,184,121,0.42)" />

          {/* Subtle top-right registration crosshair */}
          <g transform="translate(1188 64)">
            <g
              style={{
                transform: `rotate(${rotationStep * 45}deg)`,
                transition: "transform 780ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <circle cx="0" cy="0" r="6.5" stroke="rgba(220,184,121,0.25)" />
              <line x1="-20" y1="0" x2="20" y2="0" stroke="rgba(220,184,121,0.25)" />
              <line x1="0" y1="-20" x2="0" y2="20" stroke="rgba(220,184,121,0.25)" />
            </g>
          </g>
        </g>
      </svg>

      {/* Generated antique-gold acanthus & stone contour corner ornament */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/showcase/pedestal-ornament.webp"
        alt=""
        decoding="async"
        className="hidden lg:block absolute bottom-0 left-1/2 -translate-x-1/2 w-[760px] max-w-[56vw] object-contain opacity-[0.22]"
      />
    </div>
  );
}
