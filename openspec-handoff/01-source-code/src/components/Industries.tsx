"use client";

import Link from "next/link";
import Reveal from "./Reveal";
import DemoTrigger from "./DemoTrigger";

export default function Industries() {
  return (
    <section id="industries" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-70" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <div className="eyebrow mb-3">Industries</div>
            <h2 className="text-[2.25rem] md:text-[3rem] leading-[1.05] tracking-tight font-medium">
              Purpose-built for three product lines.
            </h2>
            <p className="mt-4 text-[15px] text-[var(--color-ink-soft)] max-w-xl">
              We ship deep domain logic for every category — frame profiles, glass packs, hardware
              kits, operator options, panel stacks — so your product rules land on day one.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Reveal delay={1}>
            <WindowCard />
          </Reveal>
          <Reveal delay={2}>
            <DoorCard />
          </Reveal>
          <Reveal delay={3}>
            <GarageCard />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-16 relative overflow-hidden rounded-[28px] glass-dark text-white p-10 md:p-14">
            <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[var(--color-peach)]/25 blur-3xl floaty" aria-hidden />
            <div className="absolute -bottom-20 -left-10 w-80 h-80 rounded-full bg-[var(--color-sky)]/25 blur-3xl floaty-2" aria-hidden />
            <div className="relative max-w-xl">
              <div className="eyebrow !text-white/60 mb-3">One platform</div>
              <h3 className="text-[1.8rem] md:text-[2.4rem] leading-[1.05] tracking-tight font-medium">
                Windows upstairs. Doors at the entry. Garage at the curb. One quote.
              </h3>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <DemoTrigger className="btn bg-white text-[var(--color-ink)] hover:bg-white/90">
                  Book a walkthrough
                </DemoTrigger>
                <Link href="/#pricing" className="btn btn-glass">
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Windows card — animated glass sheen + pane highlight ---------- */
function WindowCard() {
  return (
    <div className="group relative h-full rounded-[22px] glass overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.3)]">
      <div className="absolute inset-0 glass-sky opacity-50" aria-hidden />
      <div className="relative p-7 flex flex-col h-full">
        {/* Animated visual */}
        <div className="relative h-48 mb-5 flex items-center justify-center">
          <div className="relative w-[120px] h-[150px] rounded-[3px] bg-[var(--color-ink)] shadow-[0_25px_40px_-20px_rgba(22,19,16,0.5)] transition-transform duration-500 group-hover:scale-105">
            <div className="absolute inset-[7px] grid grid-cols-2 gap-[2px]">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="relative bg-gradient-to-br from-sky-100/80 to-white/70 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent" />
                  <div
                    className="absolute -left-1/3 top-0 bottom-0 w-1/3 bg-white/80 glint"
                    style={{ animationDelay: `${k * 0.3}s` }}
                  />
                </div>
              ))}
            </div>
            <div className="absolute right-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-7 rounded-sm bg-zinc-300 shadow" />
          </div>
          <span className="absolute top-2 left-4 inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-mint-ink)] pulse-dot" />
          <span className="absolute bottom-4 right-6 chip !py-0.5 !text-[10px] !bg-white/70">36" × 60"</span>
        </div>

        <div className="eyebrow">Windows</div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Casement, double-hung, sliding & more</h3>
        <p className="mt-3 text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
          Full support for fixed, tilt-turn, awning, and specialty shapes — with Low-E, argon,
          triple-pane, grille patterns, and custom mullions.
        </p>
        <ul className="mt-5 space-y-1.5 text-[13px] text-[var(--color-ink-soft)]">
          {["12+ frame profiles", "Glass IGU builder", "Grille & SDL designer"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-sky-ink)]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Doors card — 3D hinge swing ---------- */
function DoorCard() {
  return (
    <div className="group relative h-full rounded-[22px] glass overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.3)]">
      <div className="absolute inset-0 glass-peach opacity-55" aria-hidden />
      <div className="relative p-7 flex flex-col h-full">
        <div className="relative h-48 mb-5 flex items-center justify-center [perspective:800px]">
          {/* Door frame */}
          <div className="relative w-[105px] h-[170px] rounded-sm bg-gradient-to-b from-[#2a201b] to-[#1a1615] shadow-[0_24px_40px_-20px_rgba(22,19,16,0.5)]">
            {/* Door panel (animated swing) */}
            <div className="absolute inset-[6px] origin-left door-open rounded-[2px] bg-gradient-to-br from-[#8a5a3d] to-[#6a4331] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              {/* Panels */}
              <div className="absolute inset-[8px] grid grid-rows-3 gap-[6px]">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="rounded-sm border border-black/20 bg-gradient-to-b from-white/5 to-black/10" />
                ))}
              </div>
              {/* Knob */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-200 shadow" />
            </div>
          </div>
          <span className="absolute top-2 right-6 chip !py-0.5 !text-[10px] !bg-white/70">36" × 80"</span>
        </div>

        <div className="eyebrow">Doors</div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Entry, patio, French & multi-slide</h3>
        <p className="mt-3 text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
          Swing direction, panel configs, sidelites, transoms, hardware kits. Auto-generates
          rough-open specs and doorjamb details for install crews.
        </p>
        <ul className="mt-5 space-y-1.5 text-[13px] text-[var(--color-ink-soft)]">
          {["Inswing / outswing logic", "Sidelite & transom builder", "Hardware finish library"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-peach-ink)]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Garage card — roll-up animation ---------- */
function GarageCard() {
  return (
    <div className="group relative h-full rounded-[22px] glass overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.3)]">
      <div className="absolute inset-0 glass-mint opacity-60" aria-hidden />
      <div className="relative p-7 flex flex-col h-full">
        <div className="relative h-48 mb-5 flex items-end justify-center">
          {/* Garage opening */}
          <div className="relative w-[170px] h-[140px] rounded-t-md bg-[#1a1615] overflow-hidden shadow-[0_24px_40px_-20px_rgba(22,19,16,0.5)]">
            {/* Animated panels rolling up */}
            <div className="absolute inset-x-1 bottom-1 top-1 flex flex-col gap-[3px] garage-roll">
              {[0, 1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  className="flex-1 rounded-sm bg-gradient-to-b from-[#d8d3cb] to-[#b9b2a9] border border-black/5 flex items-center justify-around"
                >
                  {[0, 1, 2, 3].map((j) => (
                    <span key={j} className="h-1.5 w-5 rounded-full bg-[#9c948a]/70" />
                  ))}
                </div>
              ))}
            </div>
            {/* Driveway shadow */}
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/60" />
          </div>
          {/* Track lines */}
          <div className="absolute left-[19%] right-[19%] top-2 h-px bg-[var(--color-muted)]/30" />
          <span className="absolute top-2 left-4 chip !py-0.5 !text-[10px] !bg-white/70">16 × 7 ft</span>
        </div>

        <div className="eyebrow">Garage Doors</div>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Residential & commercial, fully specced</h3>
        <p className="mt-3 text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
          Section counts, panel designs, insulation R-values, windows, struts, and opener
          packages — quoted with installed pricing for every territory.
        </p>
        <ul className="mt-5 space-y-1.5 text-[13px] text-[var(--color-ink-soft)]">
          {["Sectional & rolling steel", "Opener & accessory kits", "Install labor pricing"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-mint-ink)]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
