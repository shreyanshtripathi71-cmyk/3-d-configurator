import Reveal from "./Reveal";

const posts = [
  {
    tag: "Guide",
    title: "How to move 200 dealers onto real-time pricing without a revolt",
    read: "7 min read",
    tint: "glass-peach",
  },
  {
    tag: "Playbook",
    title: "Configurator rules that prevent 90% of factory returns",
    read: "5 min read",
    tint: "glass-mint",
  },
  {
    tag: "Interview",
    title: "Inside Ridgewood's factory: from CSV to MES in weeks",
    read: "9 min read",
    tint: "glass-sky",
  },
  {
    tag: "Data",
    title: "What 1.4 million quotes told us about door sales in 2026",
    read: "6 min read",
    tint: "glass-berry",
  },
];

export default function Resources() {
  return (
    <section id="resources" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 mesh opacity-60" aria-hidden />
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <div className="eyebrow mb-3">From the field</div>
              <h2 className="text-[2rem] md:text-[2.5rem] leading-[1.05] tracking-tight font-medium">
                Notes from factories, dealers, and install crews.
              </h2>
            </div>
            <a href="#" className="btn btn-glass self-start">
              All articles
            </a>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {posts.map((p, i) => (
            <Reveal key={p.title} as="article" delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div className="group h-full glass rounded-[22px] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-30px_rgba(22,19,16,0.3)] cursor-pointer">
                <div className={`relative aspect-[4/3] ${p.tint} flex items-center justify-center overflow-hidden`}>
                  <div className="h-24 w-24 rounded-full bg-white/60 backdrop-blur-md border border-white/70 floaty" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity shimmer" aria-hidden />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="eyebrow">{p.tag}</div>
                  <h3 className="mt-2 text-[15px] font-semibold tracking-tight leading-snug">
                    {p.title}
                  </h3>
                  <div className="mt-auto pt-4 text-xs text-[var(--color-muted)] font-mono">
                    {p.read}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
