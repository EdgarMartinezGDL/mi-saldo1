import { useEffect } from "react";

const esCampo = (el: Element | null): el is HTMLElement =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

/** Mounted once in __root: keeps the focused field visible above the mobile keyboard. */
export function TecladoVisible() {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const centrar = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const el = document.activeElement;
        if (esCampo(el) && !el.hasAttribute("data-sin-centrar")) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 250);
    };
    const alEnfocar = (e: FocusEvent) => { if (esCampo(e.target as Element)) centrar(); };
    document.addEventListener("focusin", alEnfocar);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", centrar);
    return () => {
      clearTimeout(t);
      document.removeEventListener("focusin", alEnfocar);
      vv?.removeEventListener("resize", centrar);
    };
  }, []);
  return null;
}
