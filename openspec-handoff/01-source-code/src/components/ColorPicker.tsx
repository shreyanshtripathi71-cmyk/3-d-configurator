"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";

const finishes = [
  { name: "Obsidian", color: "#1d1d1f", stroke: null, tint: "#dcdcdd", sku: "NK-OBS-01" },
  { name: "Chalk", color: "#f5f5f7", stroke: "#d2d2d7", tint: "#ececf0", sku: "NK-CHK-02" },
  { name: "Umber", color: "#8a5a3d", stroke: null, tint: "#ecdac7", sku: "NK-UMB-03" },
  { name: "Sage", color: "#7d9c7e", stroke: null, tint: "#dbe8d9", sku: "NK-SAG-04" },
  { name: "Slate", color: "#5a6a77", stroke: null, tint: "#d4dbe4", sku: "NK-SLT-05" },
  { name: "Copper", color: "#c47a4a", stroke: null, tint: "#f0d8c4", sku: "NK-CPR-06" },
];

const CYCLE_MS = 2800;

export default function Catalog() {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const f = finishes[idx];

  const startCycle = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % finishes.length);
    }, CYCLE_MS);
  };

  useEffect(() => {
    startCycle();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const pickFinish = (i: number) => {
    setIdx(i);
    startCycle();
  };

  return (
    <section
      id="finish"
      className="relative py-28 overflow-hidden"
      style={{
        backgroundColor: f.tint,
        transition: "background-color 900ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <Reveal>
          <div className="eyebrow mb-4">Your catalog, live</div>
          <h2 className="display">
            Your product line,
            <br />
            rendered for every dealer.
          </h2>
          <p className="mt-5 text-[17px] text-[var(--color-ink-soft)] max-w-2xl mx-auto">
            Publish a new finish, profile, or hardware kit once — it lands in every dealer's
            configurator and every in-flight quote keeps its original SKU. Versioned, auditable,
            and yours to control.
          </p>
        </Reveal>

        <Reveal>
          <div className="relative mt-16 mx-auto" style={{ perspective: "1400px" }}>
            <div className="relative mx-auto w-[280px] h-[360px] [transform-style:preserve-3d] transition-transform duration-700 hover:[transform:rotateY(-8deg)_rotateX(2deg)]">
              <div
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[260px] h-8 rounded-full blur-2xl opacity-30 transition-[background] duration-700"
                style={{ background: f.color === "#f5f5f7" ? "#bbb" : f.color }}
                aria-hidden
              />

              <div
                className="relative w-full h-full rounded-[6px] transition-[background,border,box-shadow] duration-700"
                style={{
                  background: f.color,
                  border: f.stroke ? `1px solid ${f.stroke}` : "none",
                  boxShadow:
                    "0 50px 100px -40px rgba(29,29,31,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <div className="absolute inset-[14px] grid grid-cols-2 gap-[5px]">
                  {[0, 1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="relative bg-gradient-to-br from-sky-100/90 to-white/80 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent" />
                      <div
                        className="absolute -left-1/3 top-0 bottom-0 w-1/3 bg-white/85 glint"
                        style={{ animationDelay: `${k * 0.35}s` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-4 h-12 rounded-sm bg-zinc-300 shadow-md" />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-16 flex flex-wrap justify-center gap-3">
            {finishes.map((c, i) => (
              <button
                key={c.name}
                type="button"
                onClick={() => pickFinish(i)}
                className="group flex flex-col items-center gap-2"
                aria-label={c.name}
                aria-pressed={i === idx}
              >
                <span
                  className={`inline-flex h-10 w-10 rounded-full transition-all duration-300 ${
                    i === idx
                      ? "ring-2 ring-[var(--color-ink)] ring-offset-[3px] ring-offset-transparent scale-110"
                      : "group-hover:scale-110"
                  }`}
                  style={{
                    background: c.color,
                    border: c.stroke ? `1px solid ${c.stroke}` : undefined,
                  }}
                />
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider transition-opacity ${
                    i === idx ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                  }`}
                >
                  {c.sku}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={2}>
          <div className="mt-12 inline-flex chip !bg-white/90">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-accent)]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
            </svg>
            Price list v14.2 · published by ops@ridgewood-wd.com · 2h ago
          </div>
        </Reveal>
      </div>
    </section>
  );
}
