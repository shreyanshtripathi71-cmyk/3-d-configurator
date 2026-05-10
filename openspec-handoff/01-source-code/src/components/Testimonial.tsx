import Reveal from "./Reveal";

export default function Testimonial() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-70" aria-hidden />

      <div className="relative max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="rounded-[28px] glass p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-72 h-72 rounded-full bg-[var(--color-peach)] blur-3xl opacity-60 floaty" aria-hidden />
            <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-[var(--color-sky)] blur-3xl opacity-60 floaty-2" aria-hidden />

            <div className="relative">
              <div className="eyebrow mb-6">Trusted by manufacturing operators</div>
              <blockquote className="text-[1.5rem] md:text-[2rem] leading-[1.2] tracking-tight font-medium text-[var(--color-ink)]">
                <span aria-hidden className="text-[var(--color-peach-ink)]">“</span>
                We moved 140 dealers onto OpenSpec within weeks. Quote turnaround went from hours to
                minutes, and factory returns on mis-configured orders effectively went to zero —
                that alone paid for the rollout inside weeks.
                <span aria-hidden className="text-[var(--color-peach-ink)]">”</span>
              </blockquote>

              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-peach)] to-[var(--color-berry)] ring-2 ring-white shadow" />
                <div className="text-left">
                  <div className="text-sm font-semibold tracking-tight">Marcus Teller</div>
                  <div className="text-xs text-[var(--color-muted)]">VP Operations · Ridgewood Window & Door Co.</div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-3 gap-2 max-w-xl mx-auto">
                {[
                  { v: "7,400+", l: "Dealers served" },
                  { v: "$1.2B", l: "Quoted last year" },
                  { v: "< 0.4s", l: "Average price recalc" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl glass-soft p-3">
                    <div className="text-xl font-semibold tracking-tight">{s.v}</div>
                    <div className="text-[11px] font-mono text-[var(--color-muted)] mt-1 uppercase tracking-wider">
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Logo marquee */}
        <Reveal>
          <div className="relative mt-12 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--color-bg)] to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--color-bg)] to-transparent z-10" />
            <div className="flex gap-14 marquee-track w-[max-content] text-[var(--color-muted)]">
              {[...Array(2)].flatMap((_, loop) =>
                ["Ridgewood W&D", "Northshore Millwork", "Foxglove Windows", "Monolith Doors", "Kilo Glass", "Peralta Panels", "Harbor Hardware", "Fieldstone Fenestration"].map(
                  (n, i) => (
                    <span
                      key={`${loop}-${i}`}
                      className="font-mono text-[13px] tracking-tight whitespace-nowrap opacity-80"
                    >
                      ◆ {n}
                    </span>
                  )
                )
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
