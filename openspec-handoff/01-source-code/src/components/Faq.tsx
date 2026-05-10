"use client";

import { useState } from "react";
import Reveal from "./Reveal";

const items = [
  {
    q: "Does OpenSpec replace my existing ERP or MES?",
    a: "No. OpenSpec sits in front of your factory — dealers quote on us, and we hand approved orders to your ERP/MES via EDI, CSV, or our REST API. We've connected to SAP, Epicor, Global Shop, and homegrown systems.",
  },
  {
    q: "How long does a rollout take for a mid-size manufacturer?",
    a: "Fastest in the industry. Most factories with 50–250 dealers are live within days to weeks — catalog modeling and pricing tables first, then dealer onboarding in waves.",
  },
  {
    q: "Can we keep our existing pricing logic?",
    a: "Yes. Our rules engine is explicit and auditable — whatever your pricing matrix looks like (region, tier, volume, rebates, surcharges), it can be modeled and versioned without engineering help.",
  },
  {
    q: "Do dealers need to install anything?",
    a: "No installs. OpenSpec runs in any modern browser and has native iOS and Android apps for on-site quoting. Everything syncs back to your dealer portal in real time.",
  },
  {
    q: "What happens when I change prices?",
    a: "You publish a new price list version. Every new quote uses it immediately; in-flight quotes keep their original price until expiry. You can roll back a version in one click.",
  },
  {
    q: "Is our pricing data actually secure?",
    a: "Yes — SOC 2 Type II, encryption at rest and in transit, role-based permissions by dealer and territory, and region-locked pricing so your Texas tier never leaks to a New York distributor.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-50" aria-hidden />

      <div className="relative max-w-3xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-10">
            <div className="eyebrow mb-3">Frequently asked</div>
            <h2 className="text-[2rem] md:text-[2.5rem] leading-[1.05] tracking-tight font-medium">
              The questions we hear from operators.
            </h2>
          </div>
        </Reveal>

        <Reveal>
          <div className="glass rounded-[22px] divide-y divide-white/40 overflow-hidden">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <button
                  key={item.q}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full text-left px-6 py-5 flex flex-col gap-2 hover:bg-white/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-[15px] font-semibold tracking-tight">
                      {item.q}
                    </span>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/50 text-[var(--color-ink-soft)] transition-transform duration-300 ${
                        isOpen ? "rotate-45 bg-[var(--color-ink)] text-white border-transparent" : ""
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </div>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-400 ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-[14px] text-[var(--color-ink-soft)] leading-relaxed pr-10 pt-1">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
