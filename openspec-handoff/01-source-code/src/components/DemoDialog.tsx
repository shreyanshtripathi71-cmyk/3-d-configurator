"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Ctx = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const DemoCtx = createContext<Ctx | null>(null);

export function useDemo() {
  const c = useContext(DemoCtx);
  if (!c) throw new Error("useDemo must be used inside <DemoProvider>");
  return c;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <DemoCtx.Provider value={{ open, close, isOpen }}>
      {children}
      <DemoDialog />
    </DemoCtx.Provider>
  );
}

const EXIT_MS = 220;

function DemoDialog() {
  const { isOpen, close } = useDemo();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<"open" | "closed">("closed");
  const [submitted, setSubmitted] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    company: "",
    role: "",
    name: "",
    phone: "",
    email: "",
    note: "",
  });

  // On open: mount immediately and animate in. On close: animate out, then unmount.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setState("open");
    } else if (mounted) {
      setState("closed");
      const t = setTimeout(() => {
        setMounted(false);
        setSubmitted(false);
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen, mounted]);

  // Lock body scroll while mounted
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Focus first field once open
  useEffect(() => {
    if (state === "open" && !submitted) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [state, submitted]);

  // Escape to close
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, close]);

  const handleChange = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      close();
      setForm({ company: "", role: "", name: "", phone: "", email: "", note: "" });
    }, 1800);
  };

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-dialog-title"
      data-state={state}
      className="demo-root fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="demo-backdrop absolute inset-0 bg-[var(--color-ink)]/45"
        style={{
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
        }}
      />

      <div className="demo-card relative w-full max-w-lg rounded-[22px] glass p-7 md:p-8 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.55)]">
        <div aria-hidden className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-[var(--color-sky)] blur-3xl opacity-60 pointer-events-none" />
        <div aria-hidden className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-[var(--color-peach)] blur-3xl opacity-60 pointer-events-none" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/70 border border-white/80 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-white transition-colors z-10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {submitted ? (
          <div className="relative text-center py-10">
            <div className="mx-auto h-12 w-12 rounded-full bg-[var(--color-mint)] flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--color-mint-ink)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h3 className="text-[1.4rem] font-semibold tracking-tight">We got it.</h3>
            <p className="mt-2 text-[14px] text-[var(--color-ink-soft)]">
              Our implementations lead will reach out within one business day.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="eyebrow mb-2">Book a walkthrough</div>
            <h3 id="demo-dialog-title" className="text-[1.65rem] md:text-[1.85rem] font-semibold tracking-tight leading-tight">
              Tell us about your factory.
            </h3>
            <p className="mt-2 text-[13px] text-[var(--color-ink-soft)]">
              We'll reach out within one business day to scope a focused pilot.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Company name">
                  <input
                    ref={firstInputRef}
                    required
                    type="text"
                    value={form.company}
                    onChange={handleChange("company")}
                    placeholder="Ridgewood Window & Door Co."
                    className="demo-input"
                  />
                </Field>

                <Field label="I am a…">
                  <div className="relative">
                    <select
                      required
                      value={form.role}
                      onChange={handleChange("role")}
                      className="demo-input demo-select"
                    >
                      <option value="" disabled>
                        Select your role
                      </option>
                      <option value="manufacturer">Manufacturer / Factory</option>
                      <option value="dealer">Dealer / Distributor</option>
                      <option value="supplier">Supplier (glass, hardware, extrusion)</option>
                      <option value="contractor">Contractor / Installer</option>
                      <option value="architect">Architect / Spec writer</option>
                      <option value="other">Something else</option>
                    </select>
                    <svg
                      aria-hidden
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Your name">
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={handleChange("name")}
                    placeholder="Alex Morgan"
                    className="demo-input"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={handleChange("phone")}
                    placeholder="+1 (555) 123-4567"
                    className="demo-input"
                  />
                </Field>
              </div>

              <Field label="Work email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="you@yourfactory.com"
                  className="demo-input"
                />
              </Field>

              <Field label="Your website (optional)">
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={handleChange("note")}
                  placeholder="yourcompany.com — plus anything we should know: dealer count, current tools, timeline."
                  className="demo-input resize-none"
                />
              </Field>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-accent !py-2 !px-4 !text-[13px]"
                >
                  Request walkthrough
                </button>
                <span className="ml-auto text-[11px] font-mono text-[var(--color-muted)]">
                  No credit card · SOC 2
                </span>
              </div>
            </form>
          </div>
        )}
      </div>

      <style jsx>{`
        .demo-root {
          animation: demoRoot 220ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
        }
        .demo-root[data-state="closed"] {
          animation: demoRootOut 200ms cubic-bezier(0.5, 0, 0.8, 0.4) both;
        }
        .demo-backdrop {
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          animation: demoBackdrop 220ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
        }
        .demo-root[data-state="closed"] .demo-backdrop {
          animation: demoBackdropOut 200ms cubic-bezier(0.5, 0, 0.8, 0.4) both;
        }
        .demo-card {
          animation: demoCard 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .demo-root[data-state="closed"] .demo-card {
          animation: demoCardOut 200ms cubic-bezier(0.5, 0, 0.8, 0.4) both;
        }

        @keyframes demoRoot {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes demoRootOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes demoBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes demoBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes demoCard {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes demoCardOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(4px) scale(0.98); }
        }

        :global(.demo-input) {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(210, 210, 215, 0.7);
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 0.7rem 0.9rem;
          font-size: 14px;
          color: var(--color-ink);
          outline: none;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        :global(.demo-input::placeholder) {
          color: var(--color-muted);
        }
        :global(.demo-input:focus) {
          border-color: var(--color-ink);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
        }
        :global(.demo-select) {
          appearance: none;
          -webkit-appearance: none;
          padding-right: 2rem;
          cursor: pointer;
        }
        :global(.demo-select:invalid) {
          color: var(--color-muted);
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-root, .demo-backdrop, .demo-card { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
