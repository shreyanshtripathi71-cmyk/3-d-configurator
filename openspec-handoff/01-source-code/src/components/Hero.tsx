"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DemoTrigger from "./DemoTrigger";

const frames = [
  { name: "Obsidian", color: "#1d1d1f", price: 912 },
  { name: "Chalk", color: "#f5f5f7", price: 847, stroke: "#d2d2d7" },
  { name: "Umber", color: "#8a5a3d", price: 984 },
  { name: "Sage", color: "#7d9c7e", price: 1024 },
  { name: "Slate", color: "#5a6a77", price: 902 },
];

export default function Hero() {
  const [idx, setIdx] = useState(0);
  const f = frames[idx];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative pt-36 pb-20 overflow-hidden bg-off-white">
      <div className="mesh opacity-60" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <div className="chip mb-5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] pulse-dot" />
          Built for window, door & garage door operators
        </div>

        <h1 className="display-xl">Run the factory.</h1>
        <p className="mt-2 headline !font-normal text-[var(--color-ink-soft)]">
          Power the network.
        </p>

        <p className="mt-8 text-[17px] md:text-[19px] text-[var(--color-ink-soft)] max-w-2xl mx-auto leading-relaxed">
          OpenSpec is the real-time pricing and configurator platform manufacturers use to
          run their dealer networks — from first quote on a job site to the cut list on the
          shop floor.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <DemoTrigger className="btn btn-accent">
            Book a walkthrough
          </DemoTrigger>
          <Link href="/#how" className="btn-ghost-link text-[15px] inline-flex items-center gap-1">
            See how it rolls out
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <p className="mt-5 text-[12px] font-mono uppercase tracking-wider text-[var(--color-muted)]">
          SOC 2 Type II · SSO · Dedicated implementations team
        </p>
      </div>

      <div className="relative mt-16 max-w-6xl mx-auto px-6">
        <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-[var(--color-sky)] blur-3xl opacity-80 floaty" aria-hidden />
        <div className="absolute -bottom-10 -right-10 w-80 h-80 rounded-full bg-[var(--color-peach)] blur-3xl opacity-80 floaty-2" aria-hidden />

        <div className="relative rounded-[28px] glass overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/50">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4c6bf]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ecd9b4]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#c5dbc7]" />
            <span className="ml-3 text-[11px] font-mono text-[var(--color-muted)]">
              dealer-portal.ridgewood-wd.com · OpenSpec
            </span>
            <span className="ml-auto chip !py-1 !text-[11px]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] pulse-dot" />
              Live price list v14.2
            </span>
          </div>

          <div className="grid grid-cols-12 min-h-[460px]">
            <aside className="col-span-3 p-5 space-y-4 border-r border-white/50">
              <div className="eyebrow">Catalog</div>
              <nav className="space-y-1 text-[13px]">
                {[
                  { label: "Casement Window", active: true },
                  { label: "Double-hung" },
                  { label: "Sliding" },
                  { label: "Entry Door" },
                  { label: "Patio Door" },
                  { label: "Garage — Residential" },
                  { label: "Garage — Commercial" },
                ].map((i) => (
                  <div
                    key={i.label}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                      i.active
                        ? "glass-soft text-[var(--color-ink)]"
                        : "text-[var(--color-ink-soft)] hover:bg-white/40"
                    }`}
                  >
                    {i.label}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="col-span-9 p-6 text-left">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="eyebrow">Quote #Q-08421 · Dealer: Northshore Supply</div>
                  <div className="text-lg font-semibold tracking-tight mt-0.5">
                    Casement — 36" × 60"
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="chip">Tier A pricing</span>
                  <span className="chip">Low-E · Argon</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 relative rounded-2xl p-6 bg-gradient-to-br from-[#eef4fb] to-[#f4efff] min-h-[260px] overflow-hidden">
                  <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/60 blur-2xl" aria-hidden />

                  <div className="relative mx-auto mt-2 w-[170px] h-[220px]">
                    <div
                      className="absolute inset-0 rounded-[4px] transition-[background,border,box-shadow] duration-700"
                      style={{
                        background: f.color,
                        border: f.stroke ? `1px solid ${f.stroke}` : "none",
                        boxShadow: "0 20px 40px -20px rgba(29,29,31,0.35)",
                      }}
                    />
                    <div className="absolute inset-[10px] grid grid-cols-2 gap-[3px]">
                      {[0, 1, 2, 3].map((k) => (
                        <div
                          key={k}
                          className="relative bg-gradient-to-br from-sky-100/80 to-white/70 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent" />
                          <div
                            className="absolute -left-1/3 top-0 bottom-0 w-1/3 bg-white/70 glint"
                            style={{ animationDelay: `${k * 0.3}s` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-8 rounded-sm bg-zinc-300 shadow-md" />
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-[var(--color-ink-soft)]">
                    <span>Frame · {f.name}</span>
                    <span>IGU · Low-E 366 · Argon</span>
                  </div>
                </div>

                <div className="col-span-2 space-y-3">
                  <div className="rounded-xl glass-soft p-3">
                    <div className="eyebrow mb-2">Factory finish</div>
                    <div className="flex gap-2 flex-wrap">
                      {frames.map((c, i) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setIdx(i)}
                          className={`h-7 w-7 rounded-full transition-transform ${
                            i === idx
                              ? "ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-white scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{
                            background: c.color,
                            border: c.stroke ? `1px solid ${c.stroke}` : undefined,
                          }}
                          aria-label={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl glass-soft p-3 space-y-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--color-ink-soft)]">Width</span>
                      <span className="font-mono">36"</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--color-ink-soft)]">Height</span>
                      <span className="font-mono">60"</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--color-ink-soft)]">Hardware</span>
                      <span className="font-mono">Satin nickel</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--color-ink-soft)]">Lead time</span>
                      <span className="font-mono">Within days</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[var(--color-ink)] text-white p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-white/60">
                      Dealer cost · Tier A
                    </div>
                    <div className="mt-1 flex items-baseline gap-1" key={idx}>
                      <span className="text-[10px] text-white/50 font-mono">$</span>
                      <span className="text-3xl font-semibold tracking-tight tick-in">
                        {f.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-white/60 font-mono">
                      MSRP $1,420 · margin 36%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
