import { useEffect, useRef } from "react";

/** Refresh only visible, connected pages; never keep a timer in a hidden tab. */
export function useRecargaVisible(recargar: () => void, activo = true) {
  const fn = useRef(recargar);
  fn.current = recargar;
  useEffect(() => {
    if (!activo) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const disponible = () => document.visibilityState !== "hidden" && navigator.onLine;
    const refrescar = () => { if (disponible()) fn.current(); };
    const programar = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = disponible() ? setInterval(refrescar, 20_000) : undefined;
    };
    const volver = () => { programar(); refrescar(); };
    programar();
    document.addEventListener("visibilitychange", volver);
    window.addEventListener("focus", volver);
    window.addEventListener("online", volver);
    window.addEventListener("offline", programar);
    return () => {
      if (timer !== undefined) clearInterval(timer);
      document.removeEventListener("visibilitychange", volver);
      window.removeEventListener("focus", volver);
      window.removeEventListener("online", volver);
      window.removeEventListener("offline", programar);
    };
  }, [activo]);
}