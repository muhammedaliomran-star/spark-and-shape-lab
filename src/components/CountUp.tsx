import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  suffix?: string;
  /** When true, shows raw children instead of animating (e.g. masked privacy mode) */
  disabled?: boolean;
  children?: React.ReactNode;
}

export function CountUp({ value, duration = 1000, format, className, suffix, disabled, children }: Props) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (disabled) return;
    fromRef.current = display;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, disabled]);

  if (disabled) return <span className={className}>{children}</span>;

  const text = format ? format(display) : Math.round(display).toLocaleString("en-US");
  return <span className={className}>{text}{suffix}</span>;
}