import { useEffect } from "react";

/**
 * Spotlight cards: a global mousemove listener updates `--mx/--my` on every `.spot` element.
 * Call once per page (or mount in App) and it applies to all `.spot` cards.
 */
export function useSpotlight() {
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      document.querySelectorAll<HTMLElement>(".spot").forEach((card) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--my", `${e.clientY - rect.top}px`);
      });
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);
}
