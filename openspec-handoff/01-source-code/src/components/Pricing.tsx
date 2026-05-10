import Link from "next/link";
import Reveal from "./Reveal";

const plans = [
  {
    name: "Dealer",
    price: "$0",
    cadence: "included in your manufacturer's plan",
    blurb: "For contractors and dealers quoting on behalf of a manufacturer.",
    cta: "Request access",
    dark: false,
    features: [
      "Unlimited quotes per month",
      "Branded quote PDFs",
      "Mobile job-site app",
      "Live pricing from your factory",
      "Stripe & ACH payment links",
    ],
  },
  {
    name: "Studio",
    price: "$1,490",
    cadence: "per factory / month",
    blurb: "For mid-market manufacturers running a dealer network.",
    cta: "Start a pilot",
    dark: true,
    features: [
      "Up to 250 dealer seats",
      "Full configurator rules engine",
      "Multi-region pricing tables",
      "Factory MES export (CSV/EDI)",
      "Analytics & cohort dashboards",
      "Priority success manager",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "for national and multi-brand manufacturers",
    blurb: "For operators with multiple plants, brands, or countries.",
    cta: "Talk to us",
    dark: false,
    features: [
      "Everything in Studio",
      "Unlimited dealers & brands",
      "Multi-plant routing",
      "SSO (Okta, Azure AD)",
      "SOC 2 Type II artifacts",
      "Dedicated implementation team",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-50" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <div className="eyebrow mb-3">Pricing</div>
            <h2 className="text-[2.25rem] md:text-[3rem] leading-[1.05] tracking-tight font-medium">
              Priced per factory, not per quote.
            </h2>
            <p className="mt-4 text-[15px] text-[var(--color-ink-soft)] max-w-lg mx-auto">
              One flat price no matter how many dealers you onboard. No per-quote fees. No
              surprises at renewal.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={(i + 1) as 1 | 2 | 3}>
              <div
                className={`relative h-full rounded-[22px] p-7 flex flex-col overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.3)] ${
                  p.dark ? "glass-dark text-white" : "glass"
                }`}
              >
                {p.dark && (
                  <span className="absolute top-4 right-4 chip !bg-[var(--color-butter)] !border-transparent !text-[var(--color-butter-ink)]">
                    Most popular
                  </span>
                )}
                <div className={`eyebrow ${p.dark ? "!text-white/60" : ""}`}>{p.name}</div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[2.5rem] font-semibold tracking-tight leading-none">
                    {p.price}
                  </span>
                </div>
                <span className={`text-sm mt-1 ${p.dark ? "text-white/60" : "text-[var(--color-muted)]"}`}>
                  {p.cadence}
                </span>
                <p
                  className={`mt-4 text-[14px] leading-relaxed ${
                    p.dark ? "text-white/80" : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  {p.blurb}
                </p>

                <Link
                  href="/login"
                  className={`btn mt-5 ${
                    p.dark ? "bg-white text-[var(--color-ink)] hover:bg-white/90" : "btn-glass"
                  }`}
                >
                  {p.cta}
                </Link>

                <ul
                  className={`mt-6 space-y-2.5 text-[14px] ${
                    p.dark ? "text-white/85" : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`mt-0.5 shrink-0 ${
                          p.dark ? "text-[var(--color-butter)]" : "text-[var(--color-mint-ink)]"
                        }`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
