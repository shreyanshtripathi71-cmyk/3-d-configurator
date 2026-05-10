"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showMessage, setShowMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 3000);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--color-sky)] blur-3xl opacity-60" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-[var(--color-peach)] blur-3xl opacity-60" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-white text-[13px] font-semibold">
              O
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-butter)] ring-2 ring-[var(--color-bg)]" />
            </span>
            <span className="text-[20px] font-semibold tracking-tight">OpenSpec.</span>
          </Link>
          <h1 className="mt-6 text-[1.75rem] font-medium tracking-tight leading-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-ink-soft)]">
            Sign in to pick up where you left off.
          </p>
        </div>

        <div className="card p-7 shadow-[0_20px_60px_-30px_rgba(26,22,21,0.2)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block eyebrow mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourstudio.co"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-soft)] px-4 py-3 text-[14px] outline-none focus:border-[var(--color-ink)] focus:bg-white transition-colors"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block eyebrow">Password</label>
                <button type="button" className="text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-soft)] px-4 py-3 text-[14px] outline-none focus:border-[var(--color-ink)] focus:bg-white transition-colors"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-[13px] text-[var(--color-ink-soft)] cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-[var(--color-ink)]" />
              Keep me signed in on this device
            </label>

            <button type="submit" className="btn btn-dark w-full !py-3">
              Sign in
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[12px] text-[var(--color-muted)]">
            <div className="flex-1 h-px bg-[var(--color-line)]" />
            <span className="font-mono">or</span>
            <div className="flex-1 h-px bg-[var(--color-line)]" />
          </div>

          <button className="btn btn-light w-full !py-3">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3.05.6 4.19 1.56l3.13-3.13C17.45 1.79 14.97.8 12 .8 7.3.8 3.27 3.47 1.33 7.36l3.63 2.82C5.89 7.03 8.71 5 12 5z"/>
              <path fill="#4285F4" d="M23.54 12.26c0-.83-.07-1.62-.2-2.4H12v4.54h6.47c-.28 1.5-1.13 2.77-2.4 3.62l3.7 2.87c2.16-2 3.4-4.93 3.4-8.63z"/>
              <path fill="#FBBC05" d="M4.96 14.18A7.16 7.16 0 014.6 12c0-.76.13-1.5.36-2.18L1.33 6.99A11.96 11.96 0 00.06 12c0 1.94.47 3.77 1.28 5.39l3.62-3.2z"/>
              <path fill="#34A853" d="M12 23.2c3.24 0 5.95-1.07 7.93-2.91l-3.7-2.87c-1.03.7-2.35 1.1-4.23 1.1-3.29 0-6.1-2.03-7.04-4.88l-3.63 2.81C3.26 20.52 7.29 23.2 12 23.2z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[13px] text-[var(--color-ink-soft)]">
            New to OpenSpec?{" "}
            <button className="font-medium text-[var(--color-ink)] underline underline-offset-2 hover:no-underline">
              Start a trial
            </button>
          </p>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>

      {showMessage && (
        <div className="fixed bottom-6 right-6 card px-5 py-4 flex items-center gap-3 shadow-[0_20px_40px_-20px_rgba(26,22,21,0.3)] z-50">
          <div className="h-9 w-9 rounded-full bg-[var(--color-butter)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold">Demo mode</p>
            <p className="text-[12px] text-[var(--color-muted)]">Auth isn't wired up in this preview.</p>
          </div>
        </div>
      )}
    </div>
  );
}
