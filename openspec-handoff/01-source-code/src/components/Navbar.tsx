"use client";

import Link from "next/link";
import { useState } from "react";
import DemoTrigger from "./DemoTrigger";

const navLinks = [
  { href: "/#features", label: "Platform" },
  { href: "/#industries", label: "Products" },
  { href: "/#how", label: "Rollout" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <nav className="max-w-6xl mx-auto rounded-full glass-nav">
        <div className="flex items-center justify-between px-5 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-ink)] text-white text-[12px] font-semibold">
              O
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-accent)] ring-2 ring-white" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">OpenSpec.</span>
          </Link>

          <ul className="hidden md:flex items-center gap-7 text-[14px] text-[var(--color-ink-soft)]">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-[var(--color-ink)] transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" className="text-[14px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] px-3 py-1.5">
              Log in
            </Link>
            <DemoTrigger className="btn btn-dark !py-2 !px-4 text-[14px]">
              Book demo
            </DemoTrigger>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 -mr-2"
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div className="md:hidden px-5 pb-4 pt-2 space-y-3 border-t border-[var(--color-line-soft)]">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block text-[15px] text-[var(--color-ink-soft)]"
              >
                {l.label}
              </Link>
            ))}
            <DemoTrigger
              className="btn btn-dark w-full !py-2.5"
            >
              Book demo
            </DemoTrigger>
          </div>
        )}
      </nav>
    </header>
  );
}
