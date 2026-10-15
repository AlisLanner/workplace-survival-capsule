import { useEffect, useRef, useState } from "react";

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

/**
 * Count-up: animates from 0 to `target` over 1400ms once the element enters the viewport.
 * Returns a ref to attach and the formatted text to render.
 */
export function useCountUp(target: number, decimals = 0) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [text, setText] = useState((0).toFixed(decimals));
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setText((target * easeOutCubic(p)).toFixed(decimals));
        if (p < 1) requestAnimationFrame(tick);
        else setText(target.toFixed(decimals));
      };
      requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, decimals]);

  return { ref, text };
}
