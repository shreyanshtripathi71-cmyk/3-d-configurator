import Reveal from "./Reveal";

const pillars = [
  {
    title: "Catalog ingest",
    body: "Drop in your existing price sheets, CAD files, and product rules. Our rules engine maps them to a validated product model automatically.",
    meta: "CSV · Excel · XML · CAD",
  },
  {
    title: "Factory wiring",
    body: "EDI or REST to your MES on day one. SAP, Epicor, Infor, Global Shop, Dynamics, NetSuite, or a homegrown system — we've plumbed them all.",
    meta: "EDI 850 · 855 · 856 · REST",
  },
  {
    title: "Dealer onboarding",
    body: "White-labeled portals and mobile apps roll out to your dealer network in waves. Training is minimal because the tool does the thinking.",
    meta: "Web · iOS · Android",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-28 bg-off-white overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-3xl mb-14">
            <div className="eyebrow mb-3">Implementation</div>
            <h2 className="display">
              The fastest integration
              <br />
              <span className="text-[var(--color-muted)]">in the industry.</span>
            </h2>
            <p className="mt-5 text-[17px] text-[var(--color-ink-soft)] max-w-xl">
              OpenSpec delivers the fastest implementation in window, door, and garage door
              manufacturing. Your catalog goes live, your factory stays wired, and your
              dealer network is quoting on real pricing — faster than any platform on the market.
            </p>
          </div>
        </Reveal>

        {/* Headline speed callout */}
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-[var(--color-ink)] text-white p-10 md:p-14 mb-6">
            <div className="mesh-dark opacity-70" aria-hidden />
            <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[var(--color-accent)]/25 blur-3xl floaty" aria-hidden />

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 items-center">
              <div className="md:col-span-2">
                <div className="eyebrow !text-white/50 mb-3">Industry-leading speed</div>
                <h3 className="text-[2rem] md:text-[2.75rem] font-semibold tracking-tight leading-[1.05]">
                  Faster than any
                  <br />
                  configurator on the market.
                </h3>
                <p className="mt-5 text-white/70 text-[15px] leading-relaxed max-w-lg">
                  Benchmarks across 140 factory rollouts: OpenSpec goes from signed contract
                  to first production quote in a fraction of what legacy configurators need.
                  No year-long consulting project. No re-platform. No forklift rebuild.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <div className="text-[3rem] font-semibold tracking-tight leading-none">
                    #1
                  </div>
                  <div className="mt-2 text-[12px] font-mono uppercase tracking-wider text-white/50">
                    Time to first quote
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <div className="text-[3rem] font-semibold tracking-tight leading-none">
                    #1
                  </div>
                  <div className="mt-2 text-[12px] font-mono uppercase tracking-wider text-white/50">
                    MES integration speed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3 pillars of how it's delivered */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <div className="group h-full rounded-[22px] bg-white border border-[var(--color-line)] p-7 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_40px_80px_-30px_rgba(29,29,31,0.18)]">
                <div className="eyebrow">{p.meta}</div>
                <h3 className="mt-2 text-[1.35rem] font-semibold tracking-tight leading-tight">
                  {p.title}
                </h3>
                <p className="mt-3 text-[14px] text-[var(--color-ink-soft)] leading-relaxed">
                  {p.body}
                </p>
                <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)]">
                  Fastest in class
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
