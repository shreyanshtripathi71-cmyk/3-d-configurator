import Link from "next/link";

const groups = [
  {
    title: "Platform",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Industries", href: "/#industries" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "For",
    links: [
      { label: "Manufacturers", href: "#" },
      { label: "Dealers", href: "#" },
      { label: "Factories", href: "#" },
      { label: "Install crews", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Press kit", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "DPA", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative bg-cream border-t border-[var(--color-line-soft)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-40 mesh opacity-40" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-ink)] text-white text-[12px] font-semibold">
                O
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-butter)] ring-2 ring-[var(--color-bg)]" />
              </span>
              <span className="text-[17px] font-semibold tracking-tight">OpenSpec.</span>
            </div>
            <p className="mt-4 text-[14px] text-[var(--color-ink-soft)] leading-relaxed max-w-sm">
              The real-time pricing and configurator platform for window, door, and garage door
              manufacturers, dealers, and factories.
            </p>
            <form className="mt-6 flex items-center gap-2 max-w-sm">
              <input
                type="email"
                placeholder="you@yourfactory.com"
                className="flex-1 rounded-full border border-[var(--color-line)] bg-white/80 backdrop-blur px-4 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)] transition-colors"
              />
              <button type="button" className="btn btn-dark !py-2.5 !px-4">
                Subscribe
              </button>
            </form>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <div className="eyebrow mb-4">{g.title}</div>
              <ul className="space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="hairline my-10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-[var(--color-muted)] font-mono">
          <span>© {new Date().getFullYear()} OpenSpec Systems Inc. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <span>SOC 2 Type II ·</span>
            <a href="#" className="hover:text-[var(--color-ink)]">X / Twitter</a>
            <a href="#" className="hover:text-[var(--color-ink)]">LinkedIn</a>
            <a href="#" className="hover:text-[var(--color-ink)]">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
