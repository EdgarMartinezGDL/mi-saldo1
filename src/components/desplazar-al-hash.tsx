import { useEffect } from "react";

/** Scrolls to #id once on mount when the URL hash matches (sections that render after client-side loading). */
export function DesplazarAlHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);
  return null;
}
