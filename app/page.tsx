'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, AudioLines, CircleDot, Focus, Link2, Network, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Panel = 'connection' | 'workflows' | 'activity' | null;

/** Ambient geometry, independent of workflow or execution state. */
function SpatialCore({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = 0, width = 1, height = 1;
    let stopped = paused || media.matches;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const tau = Math.PI * 2;
    function render(now: number) {
      if (!ctx || !canvas) return;
      const delta = previous ? Math.min(now - previous, 40) : 0;
      previous = now;
      if (!stopped) phase.current += delta * 0.00013;
      const t = phase.current;
      pointer.x += (pointer.targetX - pointer.x) * 0.025;
      pointer.y += (pointer.targetY - pointer.y) * 0.025;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width * 0.285, height * 0.30, 245);
      const project = (x: number, y: number, z: number) => {
        const a = t * 0.25 + pointer.x * 0.13, b = -0.16 + pointer.y * 0.1;
        const rx = x * Math.cos(a) + z * Math.sin(a), rz = -x * Math.sin(a) + z * Math.cos(a);
        const ry = y * Math.cos(b) - rz * Math.sin(b), depth = y * Math.sin(b) + rz * Math.cos(b);
        const perspective = 3.6 / (3.6 - depth);
        return { x: cx + rx * radius * perspective, y: cy + ry * radius * perspective, depth };
      };
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius * 1.7);
      halo.addColorStop(0, 'rgba(92,174,198,0)');
      halo.addColorStop(0.48, 'rgba(71,151,176,0.035)');
      halo.addColorStop(1, 'rgba(71,151,176,0)');
      ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath(); ctx.arc(cx, cy, radius * (1.37 + ring * 0.09), 0, tau);
        ctx.strokeStyle = ring === 1 ? 'rgba(174,205,214,0.075)' : 'rgba(174,205,214,0.035)';
        ctx.lineWidth = 0.7; ctx.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const a = i / 120 * tau, r = radius * 1.47, length = i % 10 === 0 ? 8 : 3;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + length), cy + Math.sin(a) * (r + length));
        ctx.strokeStyle = i % 10 === 0 ? 'rgba(171,201,212,0.35)' : 'rgba(171,201,212,0.12)'; ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = t * (i % 2 ? -0.19 : 0.14) + i * 2.3;
        ctx.beginPath(); ctx.arc(cx, cy, radius * (1.38 + i * 0.087), a, a + 0.27 + i * 0.09);
        ctx.strokeStyle = i === 0 ? 'rgba(167,229,246,0.7)' : 'rgba(167,229,246,0.27)';
        ctx.lineWidth = i === 0 ? 1.6 : 1; ctx.stroke();
      }
      // Interleaved filaments provide depth and slow, coherent deformation.
      const rows = 67, segments = 150;
      for (let row = 1; row < rows; row++) {
        const lat = row / rows * Math.PI;
        let last: ReturnType<typeof project> | null = null;
        for (let j = 0; j <= segments; j++) {
          const lon = j / segments * tau;
          const ripple = 1 + 0.055 * Math.sin(lon * 5 + lat * 7 + t) + 0.022 * Math.cos(lon * 9 - lat * 4 - t * 0.7);
          const p = project(Math.sin(lat) * Math.cos(lon) * ripple, Math.cos(lat) * ripple, Math.sin(lat) * Math.sin(lon) * ripple);
          if (last) {
            const front = (p.depth + 1.2) / 2.4;
            const ridge = Math.pow((Math.sin(lon * 3 + lat * 5 - t * 0.6) + 1) / 2, 5);
            const alpha = 0.025 + Math.max(0, front) ** 2 * (0.2 + ridge * 0.48);
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(174,220,231,${alpha})`;
            ctx.lineWidth = ridge > 0.8 && front > 0.7 ? 1.1 : 0.55; ctx.stroke();
          }
          if (j % 6 === 0 && row % 3 === 0 && p.depth > 0) {
            ctx.fillStyle = `rgba(214,246,250,${0.12 + p.depth * 0.45})`; ctx.fillRect(p.x, p.y, 1.15, 1.15);
          }
          last = p;
        }
      }
      for (let orbit = 0; orbit < 2; orbit++) {
        const angle = orbit === 0 ? 0.37 : -0.7;
        let last: ReturnType<typeof project> | null = null;
        for (let j = 0; j <= 200; j++) {
          const a = j / 200 * tau, x = Math.cos(a) * 1.28, y = Math.sin(a) * 0.35, z = Math.sin(a) * 1.15;
          const p = project(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z);
          if (last) {
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(174,220,231,${p.depth > 0 ? 0.22 : 0.055})`; ctx.lineWidth = 0.7; ctx.stroke();
          }
          last = p;
        }
      }
      if (!stopped && !document.hidden) frame = requestAnimationFrame(render);
    }
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(render);
    };
    const motion = () => { stopped = paused || media.matches; resize(); };
    const visibility = () => { cancelAnimationFrame(frame); if (!document.hidden) { previous = 0; frame = requestAnimationFrame(render); } };
    const move = (event: PointerEvent) => {
      if (stopped) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.targetX = (event.clientX - bounds.left) / width - 0.5;
      pointer.targetY = (event.clientY - bounds.top) / height - 0.5;
    };
    const reset = () => { pointer.targetX = 0; pointer.targetY = 0; };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', reset);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', reset);
      media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility);
    };
  }, [paused]);
  return <canvas ref={canvasRef} className="spatial-canvas" aria-label="Slowly rotating spatial core. Ambient visualization; no workflows connected." />;
}

export default function Home() {
  const [panel, setPanel] = useState<Panel>(null);
  const [paused, setPaused] = useState(false);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocus(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  return (
    <main className={`observatory ${focus ? 'is-focused' : ''}`}>
      <header className="topbar chrome">
        <Link className="brand" href="/" aria-label="Operator Core home"><span className="brand-symbol"><AudioLines size={20} strokeWidth={1.5} /></span><span>OPERATOR<span className="brand-core"> / CORE</span></span></Link>
        <div className="top-center"><span className="hairline" /> Your AI workspace <span className="hairline" /></div>
        <button className="connection-status" onClick={() => setPanel('connection')}><span className="status-dot" /> Not connected <ArrowUpRight size={14} /></button>
      </header>
      <nav className="tool-rail chrome" aria-label="Workspace tools">
        <button className="rail-button selected" aria-label="Core visualization" title="Core visualization" onClick={() => setPanel(null)}><CircleDot size={20} strokeWidth={1.4} /></button>
        <span className="rail-divider" />
        <button className="rail-button" aria-label="Workflows" title="Workflows" onClick={() => setPanel('workflows')}><Network size={19} strokeWidth={1.4} /></button>
        <button className="rail-button" aria-label="Activity" title="Activity" onClick={() => setPanel('activity')}><Activity size={19} strokeWidth={1.4} /></button>
        <button className="rail-button" aria-label="Connection settings" title="Connection settings" onClick={() => setPanel('connection')}><SlidersHorizontal size={19} strokeWidth={1.4} /></button>
      </nav>
      <section className="core-stage" aria-label="Core visualization">
        <div className="stage-heading chrome"><span className="eyebrow">WORKSPACE / 01</span><h1>Intelligence, in view.</h1></div>
        <SpatialCore paused={paused} />
        <div className="coordinate top-coordinate chrome" aria-hidden="true">CORE / SPATIAL VIEW</div>
        <div className="core-annotation annotation-left chrome"><span className="annotation-line" /><span className="eyebrow">CONNECTION</span><span>Awaiting n8n</span></div>
        <div className="core-annotation annotation-right chrome"><span className="annotation-line" /><span className="eyebrow">WORKSPACE</span><span>No workflows connected</span></div>
        <div className="core-caption chrome"><span className="standby-label"><span /> STANDBY</span><p>Ready when you are.</p><button onClick={() => setPanel('connection')}>Connect your n8n <ArrowUpRight size={15} /></button></div>
      </section>
      <footer className="bottom-edge chrome"><span><span className="small-cross">+</span> Private workspace</span><span>Ambient visualization</span></footer>
      <fieldset className="view-dock" aria-label="Visualization controls">
        <span className="dock-label"><CircleDot size={16} /> Core</span><span className="dock-divider" />
        <button aria-label={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? 'Resume' : 'Motion'}</span></button>
        <button aria-label={focus ? 'Exit focus view' : 'Enter focus view'} aria-pressed={focus} className={focus ? 'active' : ''} onClick={() => setFocus(!focus)}><Focus size={17} /><span>{focus ? 'Exit focus' : 'Focus'}</span></button>
      </fieldset>
      <Sheet open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <SheetContent className="workspace-panel">
          <SheetHeader><span className="eyebrow">OPERATOR / CORE</span>
            <SheetTitle>{panel === 'connection' ? 'Connection' : panel === 'workflows' ? 'Your workflows' : 'Activity'}</SheetTitle>
            <SheetDescription>{panel === 'connection' ? 'Your n8n account powers this workspace.' : panel === 'workflows' ? 'Workflows you build in n8n will appear here.' : 'Executions and results will appear here.'}</SheetDescription>
          </SheetHeader>
          <div className="panel-empty">
            <div className="empty-glyph">{panel === 'connection' ? <Link2 size={27} strokeWidth={1} /> : panel === 'workflows' ? <Network size={27} strokeWidth={1} /> : <Activity size={27} strokeWidth={1} />}</div>
            <h2>{panel === 'connection' ? 'Awaiting connection' : panel === 'workflows' ? 'A clear workspace.' : 'Nothing running yet.'}</h2>
            <p>{panel === 'connection' ? 'This is the visual interface preview. Secure n8n account connection is the next integration step.' : 'Connect your n8n account when your workflows are ready.'}</p>
            {panel !== 'connection' && <Button variant="outline" onClick={() => setPanel('connection')}>Connection settings <ArrowUpRight size={15} /></Button>}
          </div>
          <div className="panel-footnote"><span className="status-dot" /> No account connected</div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
