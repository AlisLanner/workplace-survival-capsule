import { useEffect, useRef } from "react";

/**
 * Scroll-reveal: adds `.in` to the element when it enters the viewport.
 * Usage: <div ref={revealRef} data-reveal style={{ "--d": ".1s" }}>…</div>
 *
 * Supports elements rendered asynchronously (e.g. after an API response):
 * if the ref is empty when the effect runs, it polls briefly until the
 * element mounts, then observes it. This fixes scroll-reveal for pages
 * where content appears after data loads (report pages, admin detail).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const setup = (el: T) => {
      if (typeof IntersectionObserver === "undefined") {
        el.classList.add("in");
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12 }
      );
      io.observe(el);
    };

    const el = ref.current;
    if (el) {
      setup(el);
      return () => io?.disconnect();
    }

    // Element not mounted yet (async content): poll until it appears.
    let tries = 0;
    timer = setInterval(() => {
      const now = ref.current;
      if (now) {
        clearInterval(timer!);
        setup(now);
      } else if (++tries > 30) {
        // Give up after ~3s to avoid a dangling timer.
        clearInterval(timer!);
      }
    }, 100);

    return () => {
      if (timer) clearInterval(timer);
      io?.disconnect();
    };
  }, []);

  return ref;
}
