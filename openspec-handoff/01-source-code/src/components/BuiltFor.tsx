"use client";

import { useState } from "react";
import Reveal from "./Reveal";

type Role = {
  id: string;
  label: string;
  title: string;
  body: string;
  bullets: string[];
  kpi: { v: string; l: string }[];
};

const roles: Role[] = [
  {
    id: "factory",
    label: "Factory operations",
    title: "Run the plant on clean orders.",
    body: "OpenSpec hands your MES fully-validated cut lists, glass IGU specs, and hardware kits — versioned against a price list you control.",
    bullets: [
      "EDI 850 / 855 / 856 out of the box",
      "Version every price list; roll back in one click",
      "Capacity-aware lead times per plant",
      "Failure queue for rules that can't auto-resolve",
    ],
    kpi: [
      { v: "−94%", l: "Re-keyed orders" },
      { v: "−62%", l: "Factory returns" },
    ],
  },
  {
    id: "regional",
    label: "Regional manager",
    title: "See the pipeline without babysitting it.",
    body: "Territory-scoped dashboards and alerts so you know which dealers are quoting, which are converting, and which need a call this week.",
    bullets: [
      "Live pipeline by dealer and region",
      "Conversion funnels from quote → order",
      "Weekly digest emails for underperformers",
      "Territory-locked pricing so no leakage",
    ],
    kpi: [
      { v: "3.1×", l: "Quote-to-order" },
      { v: "+18%", l: "Dealer retention" },
    ],
  },
  {
    id: "dealer",
    label: "Dealer / distributor",
    title: "Quote on the driveway. Close in the kitchen.",
    body: "One portal for every brand you carry. Branded PDFs, side-by-side options, e-signature, and payment links — built for the way deals actually close.",
    bullets: [
      "Web + iOS + Android, offline-capable",
      "Branded quote PDFs with your logo",
      "Side-by-side good / better / best",
      "Stripe & ACH payment links on accept",
    ],
    kpi: [
      { v: "3 min", l: "Avg. quote time" },
      { v: "+41%", l: "Close rate" },
    ],
  },
  {
    id: "installer",
    label: "Install crew",
    title: "Show up with the right parts.",
    body: "Approved orders become job packets: rough-open specs, hardware kits, torque values, and install notes — in the crew lead's pocket.",
    bullets: [
      "Mobile-first install packets",
      "Punch-list and sign-off flow",
      "Photo capture for warranty evidence",
      "Deficiency reporting back to the factory",
    ],
    kpi: [
      { v: "−48%", l: "Callback visits" },
      { v: "92 NPS", l: "From install crews" },
    ],
  },
];

export default function BuiltFor() {
  const [active, setActive] = useState(roles[0].id);
  const r = roles.find((x) => x.id === active) ?? roles[0];

  return (
    <section className="relative py-28 bg-grey overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <div className="eyebrow mb-3">Built for operators</div>
            <h2 className="display">
              One platform.
              <br />
              <span className="text-[var(--color-muted)]">Four jobs to be done.</span>
            </h2>
            <p className="mt-5 text-[17px] text-[var(--color-ink-soft)] max-w-xl">
              OpenSpec shows up differently depending on where you sit in the org. Each role
              gets a purpose-built surface — not a generic dashboard with 40 toggles.
            </p>
          </div>
        </Reveal>

        {/* Role tabs */}
        <Reveal>
          <div className="flex flex-wrap gap-2 mb-8">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setActive(role.id)}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium tracking-tight transition-all ${
                  active === role.id
                    ? "bg-[var(--color-ink)] text-white border-transparent"
                    : "bg-white/70 text-[var(--color-ink-soft)] border-[var(--color-line)] hover:bg-white"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="rounded-[24px] bg-white border border-[var(--color-line)] overflow-hidden grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-[var(--color-line-soft)]">
              <div className="eyebrow">{r.label}</div>
              <h3 className="mt-2 text-[1.75rem] md:text-[2.25rem] font-semibold tracking-tight leading-[1.08]">
                {r.title}
              </h3>
              <p className="mt-4 text-[15px] text-[var(--color-ink-soft)] leading-relaxed">
                {r.body}
              </p>

              <ul className="mt-6 space-y-2.5">
                {r.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] text-[var(--color-ink-soft)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-[var(--color-accent)]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2 p-8 md:p-10 bg-[var(--color-bg-soft)] flex flex-col justify-center">
              <div className="eyebrow mb-5">Measured outcomes</div>
              <div className="space-y-5">
                {r.kpi.map((k) => (
                  <div key={`${r.id}-${k.l}`} className="tick-in">
                    <div className="text-[3rem] font-semibold tracking-tight leading-none">
                      {k.v}
                    </div>
                    <div className="mt-1 text-[12px] font-mono uppercase tracking-wider text-[var(--color-muted)]">
                      {k.l}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-[12px] text-[var(--color-muted)] font-mono">
                Median across cohort of 140 OpenSpec factories, 2025.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
