'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, RotateCcw, X } from 'lucide-react';
import { clamp, storyContent, storyTimeline } from './story-content';

const preferenceKey = 'dcc:story-hidden:v1';

/** A bounded scroll-driven intro with gentle continuous rotation while visible. */
export default function ScrollStory() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [animated, setAnimated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [chapter, setChapter] = useState(0);
  const chapterRef = useRef(0);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(preferenceKey) === '1'); } catch { /* Optional preference. */ }
    const query = matchMedia('(prefers-reduced-motion: reduce), (max-height: 540px)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const sync = () => setAnimated(!query.matches && !connection?.saveData);
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const section = root.current, surface = canvas.current;
    if (!animated || collapsed || !section || !surface) return;
    const ctx = surface.getContext('2d');
    if (!ctx || typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') { setAnimated(false); return; }
    let frame = 0, visible = true, width = 0, height = 0;
    let accent = '105, 230, 212';
    const palette = () => { accent = getComputedStyle(section).getPropertyValue('--accent-rgb').trim() || accent; };
    const render = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const rect = section.getBoundingClientRect();
      const stage = section.querySelector<HTMLElement>('.story-stage');
      if (!stage) return;
      const inset = parseFloat(getComputedStyle(stage).top) || 0;
      const p = clamp((inset - rect.top) / Math.max(1, section.offsetHeight - stage.offsetHeight));
      const { motion, chapter: nextChapter } = storyTimeline(p);
      if (chapterRef.current !== nextChapter) { chapterRef.current = nextChapter; setChapter(nextChapter); }
      section.style.setProperty('--journey-progress', String(p));
      section.style.setProperty('--journey-turn', `${motion * 120}deg`);
      const portrait = width < 600;
      const radius = Math.min(width * (portrait ? .36 : .38), height * .38);
      const cx = width / 2, cy = height / 2;
      const slowSpin = performance.now() * (Math.PI * 2 / 48000); // one relaxed revolution every 48 seconds
      const turn = -.25 + motion * 1.7 + slowSpin;
      const tilt = .3 + Math.sin(motion * Math.PI) * .65 + Math.sin(slowSpin * .5) * .075;
      const project = (x: number, y: number, z: number) => {
        const a = x * Math.cos(turn) + z * Math.sin(turn);
        const b = z * Math.cos(turn) - x * Math.sin(turn);
        const c = y * Math.cos(tilt) - b * Math.sin(tilt);
        const depth = y * Math.sin(tilt) + b * Math.cos(tilt);
        const perspective = 3.8 / (3.8 + depth);
        return { x: cx + a * radius * perspective, y: cy + c * radius * perspective, depth };
      };
      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.45);
      glow.addColorStop(0, `rgba(${accent},.09)`); glow.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      // One continuous object: orbit → connected sphere → resolved orbital network.
      for (let ring = 0; ring < 11; ring++) {
        const latitude = (ring / 10 - .5) * Math.PI * .86;
        const spread = .28 + Math.sin(motion * Math.PI) * .72 + motion * .27;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const a = i / 120 * Math.PI * 2;
          const point = project(Math.cos(a) * Math.cos(latitude), Math.sin(latitude) * spread, Math.sin(a) * Math.cos(latitude));
          if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = `rgba(${accent},${ring === 5 ? .7 : .11 + ring % 3 * .035})`;
        ctx.lineWidth = ring === 5 ? 1.5 : .7; ctx.stroke();
      }
      for (let meridian = 0; meridian < 8; meridian++) {
        const longitude = meridian / 8 * Math.PI * 2;
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const a = i / 80 * Math.PI * 2;
          const point = project(Math.cos(a) * Math.cos(longitude), Math.sin(a) * (.28 + Math.sin(motion * Math.PI) * .72 + motion * .27), Math.cos(a) * Math.sin(longitude));
          if (!i) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = `rgba(${accent},.12)`; ctx.lineWidth = .7; ctx.stroke();
      }
      const nodes = Array.from({ length: 12 }, (_, i) => {
        const angle = i / 12 * Math.PI * 2 + motion * .6;
        return project(Math.cos(angle) * 1.18, Math.sin(angle * 2) * (.2 + motion * .35), Math.sin(angle) * 1.18);
      }).sort((a, b) => b.depth - a.depth);
      for (const point of nodes) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = `rgba(${accent},.12)`; ctx.stroke();
        ctx.beginPath(); ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accent},${point.depth > 0 ? .4 : .95})`; ctx.fill();
        ctx.beginPath(); ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${accent},.2)`; ctx.stroke();
      }
      section.dataset.rendered = 'true';
      // Render only while the intro is on screen; pause when hidden or dismissed.
      if (visible && !document.hidden) frame = requestAnimationFrame(render);
    };
    const request = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); };
    const resize = () => {
      const bounds = surface.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.75);
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); request();
    };
    palette(); resize();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) request(); else { cancelAnimationFrame(frame); frame = 0; } }, { rootMargin: '100px' });
    observer.observe(section);
    const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(surface);
    const themeObserver = new MutationObserver(() => { palette(); request(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', request);
    const lost = () => setAnimated(false);
    surface.addEventListener('contextlost', lost);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); sizeObserver.disconnect(); themeObserver.disconnect();
      window.removeEventListener('scroll', request); window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', request);
      surface.removeEventListener('contextlost', lost);
      delete section.dataset.rendered;
    };
  }, [animated, collapsed]);

  const goToPanels = () => {
    const target = document.getElementById(storyContent.destination);
    target?.scrollIntoView({ behavior: 'auto', block: 'start' });
    target?.focus({ preventScroll: true });
  };
  const dismiss = () => {
    try { localStorage.setItem(preferenceKey, '1'); } catch { /* Optional preference. */ }
    setCollapsed(true);
    requestAnimationFrame(goToPanels);
  };
  const replay = () => {
    try { localStorage.removeItem(preferenceKey); } catch { /* Optional preference. */ }
    chapterRef.current = 0; setChapter(0); setCollapsed(false);
    requestAnimationFrame(() => root.current?.scrollIntoView({ behavior: 'auto', block: 'start' }));
  };
  if (collapsed) return <div className="story-replay"><span>Твоето работно пространство</span><button type="button" onClick={replay}><RotateCcw size={14} />Пусни въведението</button></div>;
  const scene = storyContent.scenes[animated ? chapter : 0];
  return <section ref={root} className={`scroll-story ${animated ? 'story-motion' : 'story-static'}`} aria-label="Въведение в командния център">
    <div className="story-stage">
      <div className="story-topline"><span><i />{storyContent.label}</span><button type="button" onClick={dismiss} aria-label="Скрий въведението"><X size={17} /><span>Скрий</span></button></div>
      <div className="story-art" aria-hidden="true">
        <div className="story-floor" />
        <div className="story-poster"><i /><i /><i /></div>
        {animated && <canvas ref={canvas} />}
        <div className="story-emblem"><img src="/voicecommand-logo.svg" width="120" height="76" alt="" /><span>YOUR CONTROL CORE</span></div>
        <span className="story-coordinate coordinate-a">SIGNAL / 001</span><span className="story-coordinate coordinate-b">CONNECTED SPACE</span>
      </div>
      <div className="story-copy">
        <p className="story-kicker"><span>0{(animated ? chapter : 0) + 1}</span> / {scene.label}</p>
        <h2>{scene.title}</h2>
        <p className="story-description">{scene.description}</p>
        <a className="story-action" href={`#${storyContent.destination}`} onClick={event => { event.preventDefault(); goToPanels(); }}>{storyContent.action}<ArrowUpRight size={18} /></a>
      </div>
      <div className="story-bottomline"><span className="story-scroll-cue"><ArrowDown size={14} />Превърти, за да разгледаш</span><div className="story-chapters" aria-label="Сцени">{storyContent.scenes.map((item, i) => <span key={item.label} className={i === (animated ? chapter : 0) ? 'is-current' : ''}>0{i + 1}<b>{item.label}</b></span>)}</div></div>
      <div className="story-progress" aria-hidden="true"><i /></div>
    </div>
    {!animated && <div className="story-static-summary">{storyContent.scenes.slice(1).map(item => <p key={item.label}><strong>{item.label}</strong>{item.description}</p>)}</div>}
  </section>;
}
