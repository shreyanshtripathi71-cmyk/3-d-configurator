import Reveal from "./Reveal";

const tiles = [
  {
    eyebrow: "Precision",
    title: "Sub-second price recalc on every change.",
    body: "A rules engine that evaluates 200+ dependencies on every swap — glass pack, frame, hardware, install — then re-quotes before your dealer's cursor leaves the control.",
    tint: "from-[#101014] to-[#1d1d1f]",
    accent: "#7aa7ff",
    icon: (
      <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle cx="40" cy="40" r="28" />
        <circle cx="40" cy="40" r="18" />
        <path d="M40 16v10M40 54v10M16 40h10M54 40h10" />
      </svg>
    ),
  },
  {
    eyebrow: "Visibility",
    title: "Every dealer, every quote, every territory.",
    body: "Territory-scoped dashboards let regional managers watch the pipeline in real time, without giving dealers a peek at each other's margins.",
    tint: "from-[#1a2538] to-[#0f1a2e]",
    accent: "#a5c8ff",
    icon: (
      <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="0.8">
        <path d="M10 60h60M18 60V40M32 60V30M46 60V20M60 60V34" />
      </svg>
    ),
  },
  {
    eyebrow: "Reliability",
    title: "Orders the floor can build, on the first pass.",
    body: "Approved quotes flow to your MES with validated cut lists, glass IGU specs, and hardware kits — no re-keying, no fax, no mis-configured returns.",
    tint: "from-[#251f17] to-[#161310]",
    accent: "#f2c492",
    icon: (
      <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="0.8">
        <rect x="16" y="20" width="48" height="40" rx="2" />
        <path d="M16 32h48M24 44h10M24 50h18" />
      </svg>
    ),
  },
];

export default function CloserLook() {
  return (
    <section className="relative py-28 bg-ink overflow-hidden">
      <div className="mesh-dark" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <div className="eyebrow !text-white/50 mb-3">Take a closer look</div>
            <h2 className="display !text-white">
              Three things we obsess over.
            </h2>
            <p className="mt-5 text-[17px] text-white/70 max-w-xl">
              The difference between a configurator that ships and a configurator that sits
              in a review deck, unused.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((t, i) => (
            <Reveal key={t.title} delay={(i + 1) as 1 | 2 | 3}>
              <article
                className={`group relative h-full rounded-[24px] p-8 overflow-hidden bg-gradient-to-br ${t.tint} border border-white/8 transition-all duration-500 hover:-translate-y-1`}
              >
                <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full opacity-20 blur-3xl floaty" style={{ background: t.accent }} aria-hidden />

                <div className="relative h-36 flex items-center justify-center mb-8">
                  <div
                    className="w-28 h-28 opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:rotate-3"
                    style={{ color: t.accent }}
                  >
                    {t.icon}
                  </div>
                </div>

                <div className="relative">
                  <div className="eyebrow !text-white/50">{t.eyebrow}</div>
                  <h3 className="mt-2 text-[1.4rem] font-semibold tracking-tight leading-snug text-white">
                    {t.title}
                  </h3>
                  <p className="mt-3 text-[14px] text-white/70 leading-relaxed">{t.body}</p>
                </div>

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shimmer" aria-hidden />
              </article>
            </Reveal>
          ))}
        </div>

        {/* Spec strip */}
        <Reveal>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 border-t border-white/10 pt-10">
            {[
              { v: "< 0.4s", l: "Avg. price recalc" },
              { v: "99.98%", l: "Quote uptime" },
              { v: "7,400+", l: "Active dealers" },
              { v: "42", l: "Countries served" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-[2rem] font-semibold tracking-tight text-white">{s.v}</div>
                <div className="mt-1 text-[12px] font-mono uppercase tracking-wider text-white/50">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
