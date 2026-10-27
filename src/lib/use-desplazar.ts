import { useEffect, useRef } from "react";

const suave = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * Returns a ref for a block that appears on tap. When `abierto` turns true, scrolls it to the top
 * (below the fixed app bar via `data-desplegable` scroll-margin) and, with `enfocar`, focuses its first field.
 */
export function useDesplazarAlAbrir<T extends HTMLElement = HTMLDivElement>(abierto: unknown, enfocar = false) {
  const ref = useRef<T>(null);
  const activo = !!abierto;
  useEffect(() => {
    if (!activo) return;
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.setAttribute("data-desplegable", "");
      el.scrollIntoView?.({ behavior: suave(), block: "start" });
      if (enfocar) {
        const campo = el.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])");
        campo?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(id);
    // Only on the false -> true transition (or a new key value).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, typeof abierto === "string" || typeof abierto === "number" ? abierto : null]);
  return ref;
}
