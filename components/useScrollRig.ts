"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { store } from "@/lib/store";

/** Lenis smooth scroll + ScrollTrigger feeding the shared progress store. */
export function useScrollRig() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const st = ScrollTrigger.create({
      trigger: "#experience-track",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        store.target = self.progress;
      },
    });

    // pointer tracking (idle detection + trail happens in the scene loop)
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      store.ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      store.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      store.speed = Math.min(60, Math.hypot(dx, dy));
      store.lastMove = performance.now();
      store.hasPointer = true;
    };
    const onDown = (e: PointerEvent) => {
      // ignore clicks on nav / links
      if ((e.target as HTMLElement).closest("a,button")) return;
      store.pendingClick = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      st.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}
