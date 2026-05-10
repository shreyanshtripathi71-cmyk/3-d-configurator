import Reveal from "./Reveal";

const features = [
  {
    tint: "peach",
    eyebrow: "01 · Pricing",
    title: "Real-time pricing, to the penny.",
    body: "Instant quotes for any window, door, or garage door configuration. Change glass, size, or hardware and the price ticks in under a second.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <path d="M4 7h16v10H4z" />
        <path d="M4 11h16" />
        <circle cx="17" cy="14" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    tint: "sky",
    eyebrow: "02 · Configurator",
    title: "Every option, every dependency.",
    body: "Rules-based configurator that enforces valid combinations — so dealers never quote a sash profile that doesn't ship with that glass pack.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 4v16M4 12h16" />
      </svg>
    ),
  },
  {
    tint: "mint",
    eyebrow: "03 · Dealers",
    title: "Your whole dealer network, one portal.",
    body: "Tiered pricing, branded order pages, and activity analytics per dealer — from your biggest distributor to your newest contractor.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="11" r="2.3" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2.3 2-3.6 4-3.6s3 1.3 3 3.6" />
      </svg>
    ),
  },
  {
    tint: "butter",
    eyebrow: "04 · Factory",
    title: "Orders land on the shop floor.",
    body: "Approved quotes flow straight to your MES with full cut lists, glass specs, and hardware kits — no more re-keying orders at 6am.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <path d="M3 20h18M5 20V10l4 2V8l4 2V8l4 2v10" />
      </svg>
    ),
  },
  {
    tint: "berry",
    eyebrow: "05 · Insights",
    title: "See what's selling, where.",
    body: "Which profiles ship most in Texas? Which dealer closes the biggest jobs? Dashboards built for window & door operators, not consultants.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <path d="M4 19V5M4 19h16" />
        <path d="M8 15V9m4 6v-4m4 4V7" />
      </svg>
    ),
  },
  {
    tint: "peach",
    eyebrow: "06 · Security",
    title: "Enterprise-grade access control.",
    body: "Role-based permissions per dealer, factory, and territory. SSO, audit trail, and region-locked pricing so no one sees what they shouldn't.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-6 h-6">
        <path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
      </svg>
    ),
  },
];

const tintBg: Record<string, string> = {
  peach: "glass-peach",
  mint: "glass-mint",
  sky: "glass-sky",
  butter: "glass-butter",
  berry: "glass-berry",
};

export default function Features() {
  return (
    <section id="features" className="relative py-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] opacity-70" aria-hidden>
        <div className="mesh" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <div className="eyebrow mb-3">What's inside</div>
            <h2 className="text-[2.25rem] md:text-[3rem] leading-[1.05] tracking-tight font-medium">
              Built for the way windows and doors <em className="not-italic bg-[var(--color-butter)] px-2 rounded-md">actually ship.</em>
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Reveal key={f.title} as="article" delay={(i % 3 + 1) as 1 | 2 | 3}>
              <div className="group relative h-full rounded-[22px] p-7 glass overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.28)]">
                <div className={`absolute inset-0 opacity-50 group-hover:opacity-80 transition-opacity ${tintBg[f.tint]}`} aria-hidden />
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-white/60 border border-white/70 backdrop-blur flex items-center justify-center text-[var(--color-ink)] mb-6 group-hover:rotate-[-6deg] transition-transform duration-500">
                    {f.icon}
                  </div>
                  <div className="eyebrow">{f.eyebrow}</div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight leading-snug">{f.title}</h3>
                  <p className="mt-3 text-[15px] text-[var(--color-ink-soft)] leading-relaxed">{f.body}</p>
                </div>

                {/* shimmer on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shimmer" aria-hidden />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
