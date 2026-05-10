import Link from "next/link";
import Reveal from "./Reveal";
import DemoTrigger from "./DemoTrigger";

export default function Cta() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-80" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] glass-dark text-white p-10 md:p-16">
            <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[var(--color-peach)]/30 blur-3xl floaty" aria-hidden />
            <div className="absolute -bottom-20 -left-10 w-80 h-80 rounded-full bg-[var(--color-sky)]/30 blur-3xl floaty-2" aria-hidden />
            <div className="absolute top-6 right-6 w-24 h-24 opacity-30 spin-slow" aria-hidden>
              <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeWidth="0.6">
                <circle cx="50" cy="50" r="48" />
                <circle cx="50" cy="50" r="36" />
                <circle cx="50" cy="50" r="24" />
                <path d="M50 2v96M2 50h96" />
              </svg>
            </div>

            <div className="relative max-w-xl">
              <div className="eyebrow !text-white/60 mb-4">Ready when you are</div>
              <h3 className="text-[2rem] md:text-[2.75rem] leading-[1.05] tracking-tight font-medium">
                Put your window, door, and garage door business
                <span className="inline-block mx-2 -translate-y-0.5 h-[0.8em] w-[1.2em] rounded-full bg-[var(--color-butter)] align-middle" />
                on one calm platform.
              </h3>
              <p className="mt-5 text-white/70 text-[15px] leading-relaxed max-w-lg">
                Short pilot. We migrate one product line and ten dealers in days — if it doesn't
                feel better than what you have, walk away.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <DemoTrigger className="btn bg-white text-[var(--color-ink)] hover:bg-white/90">
                  Book a demo
                </DemoTrigger>
                <Link href="/#features" className="btn btn-glass !border-white/15 !bg-white/10 !text-white hover:!bg-white/20">
                  Take the tour
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
