"use client";

import dynamic from "next/dynamic";
import { Navbar } from "@/components/Navbar";
import { Hud } from "@/components/Hud";
import { TimeSlider } from "@/components/TimeSlider";
import { Works } from "@/components/Works";
import { useScrollRig } from "@/components/useScrollRig";

const Experience = dynamic(() => import("@/components/three/Experience"), {
  ssr: false,
});

export default function Home() {
  useScrollRig();

  return (
    <>
      <div className="stage">
        <Experience />
      </div>

      <Navbar />
      <Hud />
      <TimeSlider />

      <main className="content">
        {/* scroll runway for the cinematic sequence */}
        <div className="spacer" id="experience-track" />
        <Works />
      </main>

      <div className="grain" aria-hidden />
    </>
  );
}
