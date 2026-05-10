import Reveal from "./Reveal";

const brands = [
  "Ridgewood W&D",
  "Northshore Millwork",
  "Foxglove Windows",
  "Monolith Doors",
  "Kilo Glass Co.",
  "Peralta Panels",
  "Harbor Hardware",
  "Fieldstone Fenestration",
  "Ironbark Factory",
  "Lumenworks",
];

export default function TrustedBy() {
  return (
    <section className="relative py-14 bg-white-clean border-y border-[var(--color-line-soft)]">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="eyebrow">
              500+ factories · 7,400+ dealers · 42 countries
            </div>
            <div className="text-[13px] text-[var(--color-muted)] font-mono">
              $1.2B quoted on OpenSpec last year
            </div>
          </div>
        </Reveal>

        <div className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex gap-14 marquee-track w-[max-content] items-center text-[var(--color-ink-soft)]">
            {[...Array(2)].flatMap((_, loop) =>
              brands.map((n, i) => (
                <span
                  key={`${loop}-${i}`}
                  className="font-semibold text-[18px] tracking-tight whitespace-nowrap opacity-70 hover:opacity-100 transition-opacity"
                >
                  {n}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
