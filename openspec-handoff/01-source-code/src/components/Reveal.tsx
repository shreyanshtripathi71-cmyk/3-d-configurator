"use client";

import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  as?: "div" | "section" | "article" | "li" | "span";
  className?: string;
};

export default function Reveal({ children, delay = 0, as = "div", className }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.setAttribute("data-reveal", "in");
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "-40px 0px -40px 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      data-reveal=""
      data-delay={delay || undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
