"use client";

import { useRef, useState } from "react";

/** Full-quality master hosted outside the repo (e.g. an R2 bucket); falls back to the copy in /public. */
const REMOTE = process.env.NEXT_PUBLIC_HERO_VIDEO_URL;

/** The Nightly explainer: plays muted on loop; one click restarts it with sound. */
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (!sound) {
      v.muted = false;
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.muted = true;
    }
    setSound(!sound);
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#8e8ad6] shadow-soft">
      <video
        ref={ref}
        className="block aspect-video w-full"
        poster="/video/nightly-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Nightly explainer: a ghost that watches your AI agents at night"
      >
        {REMOTE && <source src={REMOTE} type="video/mp4" />}
        <source src="/video/nightly.webm" type="video/webm" />
        <source src="/video/nightly.mp4" type="video/mp4" />
      </video>
      <button
        onClick={toggle}
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-fg shadow-soft transition"
        style={{ background: "rgba(255,255,255,0.95)" }}
      >
        {sound ? "🔇 Mute" : "🔊 Play with sound"}
      </button>
    </div>
  );
}
