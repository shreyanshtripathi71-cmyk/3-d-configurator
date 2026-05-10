import Reveal from "./Reveal";

const integrations = [
  { name: "SAP", cat: "ERP" },
  { name: "Epicor Kinetic", cat: "ERP" },
  { name: "Infor LN", cat: "ERP" },
  { name: "Global Shop", cat: "ERP" },
  { name: "NetSuite", cat: "ERP" },
  { name: "Microsoft Dynamics", cat: "ERP" },
  { name: "QuickBooks", cat: "Accounting" },
  { name: "Xero", cat: "Accounting" },
  { name: "Salesforce", cat: "CRM" },
  { name: "HubSpot", cat: "CRM" },
  { name: "Okta", cat: "SSO" },
  { name: "Azure AD", cat: "SSO" },
];

const trust = [
  { t: "SOC 2 Type II", b: "Annual audit. Bridge letter available on request." },
  { t: "ISO 27001", b: "Certified ISMS across cloud, ops, and HR." },
  { t: "SSO & SCIM", b: "Okta, Azure AD, Google Workspace, custom SAML." },
  { t: "Data residency", b: "US, EU, CA regions. Per-tenant encryption keys." },
  { t: "Role-based access", b: "Per dealer, territory, plant, and price tier." },
  { t: "Audit log", b: "Every price change, quote, and order — exportable." },
];

export default function Enterprise() {
  return (
    <section className="relative py-28 bg-grey overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <div className="eyebrow mb-3">Enterprise-ready</div>
            <h2 className="display">
              Fits your stack.
              <br />
              <span className="text-[var(--color-muted)]">Passes your audit.</span>
            </h2>
            <p className="mt-5 text-[17px] text-[var(--color-ink-soft)] max-w-xl">
              OpenSpec is built for factories with real IT, real security teams, and real
              compliance obligations. No forklift rebuild. No data-residency headaches.
            </p>
          </div>
        </Reveal>

        {/* Integrations grid */}
        <Reveal>
          <div className="rounded-[24px] bg-white border border-[var(--color-line)] overflow-hidden">
            <div className="px-7 py-5 border-b border-[var(--color-line-soft)] flex items-center justify-between flex-wrap gap-2">
              <div className="eyebrow">Integrations · 1,000+</div>
              <a href="#" className="btn-ghost-link text-[13px] inline-flex items-center gap-1">
                Browse full directory
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {integrations.map((i) => (
                <div
                  key={i.name}
                  className="p-5 border-r border-b border-[var(--color-line-soft)] last:border-r-0 flex items-center justify-between gap-3 hover:bg-[var(--color-bg-soft)] transition-colors"
                >
                  <div>
                    <div className="text-[14px] font-semibold tracking-tight">{i.name}</div>
                    <div className="eyebrow mt-0.5 !text-[10px]">{i.cat}</div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-[var(--color-bg-soft)] border border-[var(--color-line)] flex items-center justify-center text-[10px] font-mono text-[var(--color-muted)]">
                    {i.name.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Trust & compliance */}
        <Reveal>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trust.map((x, i) => (
              <div
                key={x.t}
                className="rounded-[20px] bg-white border border-[var(--color-line)] p-6 flex gap-4"
                data-delay={((i % 3) + 1)}
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-[var(--color-ink)] text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
                    <path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold tracking-tight">{x.t}</div>
                  <p className="mt-1 text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
                    {x.b}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Data flow diagram */}
        <Reveal>
          <div className="mt-10 relative rounded-[24px] bg-[var(--color-ink)] text-white p-8 md:p-10 overflow-hidden">
            <div className="mesh-dark opacity-60" aria-hidden />
            <div className="relative grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {[
                { l: "Dealer portal", s: "Web · iOS · Android" },
                { l: "OpenSpec rules", s: "Versioned catalog" },
                { l: "Price list", s: "Live, territory-locked" },
                { l: "EDI / REST", s: "850 · 855 · webhooks" },
                { l: "Your MES", s: "SAP · Epicor · Infor" },
              ].map((n, i, arr) => (
                <div key={n.l} className="relative">
                  <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                    <div className="text-[13px] font-semibold tracking-tight">{n.l}</div>
                    <div className="text-[11px] font-mono text-white/60 mt-0.5">{n.s}</div>
                  </div>
                  {i !== arr.length - 1 && (
                    <svg
                      className="hidden md:block absolute top-1/2 -right-3 w-6 h-6 text-white/40 -translate-y-1/2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
