'use client';

import Image from 'next/image';

/** Ambient identity animation, never an execution indicator. */
export function HudCore({ connected, empty = false }: { connected: number; empty?: boolean }) {
  return (
    <div
      className="hud-core"
      aria-label={empty ? 'AI Crafters Pro system design space' : `AI Crafters Pro, ${connected} workflows on the map`}
    >
      <svg viewBox="0 0 360 360" aria-hidden="true">
        <circle className="core-track" cx="180" cy="180" r="174" />
        <circle className="core-ticks" cx="180" cy="180" r="164" />
        <g className="core-rotate">
          <circle className="core-segments" cx="180" cy="180" r="148" />
          <circle className="core-fine" cx="180" cy="180" r="134" />
        </g>
        <g className="core-reverse">
          <circle className="core-inner" cx="180" cy="180" r="122" />
          <circle className="core-arc" cx="180" cy="180" r="112" />
        </g>
        <circle className="core-halo" cx="180" cy="180" r="102" />
      </svg>
      <div className="core-identity">
        <Image
          src="/ai-crafters-pro-logo.png"
          width={180}
          height={45}
          alt="AI Crafters Pro"
          priority
        />
        <span>{empty ? 'System design mode' : `${connected} on map`}</span>
      </div>
    </div>
  );
}
