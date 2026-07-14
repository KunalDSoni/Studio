"use client";

import { useEffect, useRef } from "react";
import { store, seg } from "@/lib/store";
import { STAGE_NAMES } from "@/lib/environment";

// Thumb tints per stage (morning cool-gold → evening indigo)
const THUMB_COLORS = ["#f4d9a6", "#f7ecd2", "#f9f3e2", "#f2b268", "#4a5474"];

export function TimeSlider() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const lastStage = useRef(-1);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const root = rootRef.current;
      const thumb = thumbRef.current;
      const label = labelRef.current;
      if (!root || !thumb || !label) return;

      const vis = seg(store.progress, 0.93, 0.985);
      root.style.opacity = String(vis);
      root.style.pointerEvents = vis > 0.6 ? "auto" : "none";
      root.style.visibility = vis <= 0.01 ? "hidden" : "visible";

      const t = store.time;
      thumb.style.left = `${t * 100}%`;
      const stage = Math.round(t * (STAGE_NAMES.length - 1));
      if (stage !== lastStage.current) {
        lastStage.current = stage;
        label.textContent = STAGE_NAMES[stage];
        thumb.style.background = THUMB_COLORS[stage];
        root.setAttribute("aria-valuetext", STAGE_NAMES[stage]);
      }
      root.setAttribute("aria-valuenow", String(Math.round(t * 100)));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    store.timeTarget = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  return (
    <div
      ref={rootRef}
      className="timeslider"
      role="slider"
      tabIndex={0}
      aria-label="Time of day"
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const keys = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"];
        if (!keys.includes(e.key)) return;
        e.preventDefault(); // keep arrows from scrolling the page mid-adjust
        if (e.key === "ArrowRight" || e.key === "ArrowUp")
          store.timeTarget = Math.min(1, store.timeTarget + 0.05);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown")
          store.timeTarget = Math.max(0, store.timeTarget - 0.05);
        if (e.key === "Home") store.timeTarget = 0;
        if (e.key === "End") store.timeTarget = 1;
      }}
    >
      <span className="timeslider__label" ref={labelRef}>
        Golden Hour
      </span>
      <div className="timeslider__track" ref={trackRef}>
        {STAGE_NAMES.map((name, i) => (
          <span
            key={name}
            className="timeslider__dot"
            style={{ left: `${(i / (STAGE_NAMES.length - 1)) * 100}%` }}
          />
        ))}
        <div className="timeslider__thumb" ref={thumbRef} />
      </div>
    </div>
  );
}
