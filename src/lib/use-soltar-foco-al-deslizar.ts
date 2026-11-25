import { useEffect } from "react";

/**
 * Claude (2026-11-24): al deslizar fuera del campo enfocado se le quita el foco.
 * En Android, al deslizar se oculta o aparece la barra del navegador y cambia el
 * alto de la ventana; si una fecha o un texto seguía enfocado, Chrome regresaba la
 * página de golpe a ese campo (salto de 200 a 540 px en Reportes). Tocar fuera ya
 * quita el foco; deslizar no, y eso es lo que hace este gancho.
 */
export function useSoltarFocoAlDeslizar() {
  useEffect(() => {
    const alTocar = (e: TouchEvent) => {
      const activo = document.activeElement;
      if (!(activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement)) return;
      if (e.target instanceof Node && activo.contains(e.target)) return;
      activo.blur();
      // En Chrome, blur() no suelta un campo de fecha: se pasa el foco a <main> sin desplazar la página.
      if (document.activeElement === activo) {
        const destino = document.querySelector("main");
        if (destino instanceof HTMLElement) {
          if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
          destino.style.outline = "none";
          destino.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener("touchstart", alTocar, { passive: true });
    return () => document.removeEventListener("touchstart", alTocar);
  }, []);
}
