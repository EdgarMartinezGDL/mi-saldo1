import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export function useConMouse() {
  const consulta = "(pointer: fine) and (hover: hover)";
  const [fino, setFino] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(consulta);
    if (!mql) return;
    const cambio = () => setFino(mql.matches);
    cambio();
    mql.addEventListener?.("change", cambio);
    return () => mql.removeEventListener?.("change", cambio);
  }, []);
  return fino;
}

const esCampoTexto = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
const dialogoEncima = (dentro: HTMLElement | null) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]'))
    .some((d) => !dentro || !d.contains(dentro));

export interface OpcionesTecla {
  activo?: boolean;
  ref?: RefObject<HTMLElement | null>;
  inclusoEnCampos?: boolean;
}

export function useTecla(manejar: (e: KeyboardEvent) => boolean | void, { activo = true, ref, inclusoEnCampos = false }: OpcionesTecla = {}) {
  const fn = useRef(manejar);
  fn.current = manejar;
  useEffect(() => {
    if (!activo) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!inclusoEnCampos && esCampoTexto(e.target)) return;
      if (dialogoEncima(ref?.current ?? null)) return;
      if (fn.current(e) === true) e.preventDefault();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [activo, ref, inclusoEnCampos]);
}

export function useDigitos(onKey: (k: string) => void, opciones: OpcionesTecla = {}) {
  useTecla((e) => {
    if (/^[0-9]$/.test(e.key)) { onKey(e.key); return true; }
    if (e.key === "Backspace") { onKey("borrar"); return true; }
    if (e.key === "Delete") { onKey("limpiar"); return true; }
    return false;
  }, opciones);
}

export function Tecla({ children }: { children: ReactNode }) {
  const conMouse = useConMouse();
  if (!conMouse) return null;
  return <kbd className="ml-2 inline-flex min-w-7 items-center justify-center rounded-md border border-current/30 px-1.5 py-0.5 font-mono text-xs font-semibold opacity-80">{children}</kbd>;
}

/** Desktop-only focus; touch devices never open their keyboard automatically. */
export function useFocoCaja(ref?: RefObject<HTMLElement | null>, cambio?: unknown) {
  const conMouse = useConMouse();
  useEffect(() => {
    if (!conMouse) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    ref?.current?.focus({ preventScroll: true });
  }, [conMouse, ref, cambio]);
}