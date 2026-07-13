"use client";

import { useEffect, useRef } from "react";
import { store, seg } from "@/lib/store";

export function Hud() {
  const introRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = store.progress;

      if (introRef.current) {
        const o = 1 - seg(p, 0.015, 0.07);
        introRef.current.style.opacity = String(o);
        introRef.current.style.transform = `translate(-50%, calc(-50% - ${seg(p, 0.0, 0.08) * 60}px))`;
        introRef.current.style.visibility = o <= 0.01 ? "hidden" : "visible";
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = String(1 - seg(p, 0.005, 0.04));
      }

      if (fillRef.current) {
        fillRef.current.style.transform = `scaleY(${p})`;
      }
      if (meterRef.current) {
        meterRef.current.style.opacity = String(seg(p, 0.01, 0.05) * (1 - seg(p, 0.93, 0.98)));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hud" aria-hidden>
      <div className="hud__intro" ref={introRef}>
        <p className="hud__kicker">Studio — interior architecture</p>
        <h1 className="hud__title">
          Every masterpiece begins
          <br />
          with a <em>blank canvas</em>.
        </h1>
      </div>

      <div className="hud__hint" ref={hintRef}>
        <span>Scroll to build</span>
        <span className="hud__hint-line" />
      </div>

      <div className="hud__meter" ref={meterRef}>
        <div className="hud__meter-fill" ref={fillRef} />
      </div>
    </div>
  );
}
