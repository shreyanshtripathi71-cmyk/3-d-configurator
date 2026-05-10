"use client";

import { useDemo } from "./DemoDialog";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function DemoTrigger({ children, className }: Props) {
  const { open } = useDemo();
  return (
    <button type="button" onClick={open} className={className}>
      {children}
    </button>
  );
}
