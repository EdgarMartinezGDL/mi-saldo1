import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useConMouse, useFocoCaja, useTecla } from "./teclado";

/** Shared Enter path for native form submission and keys outside text fields. */
export function useTecladoOperacion({ listo, ocupado, soloCodigo = false, onConfirmar, onVolver, destino, onOpcion, onCantidad }: {
  listo: boolean; ocupado: boolean; soloCodigo?: boolean; onConfirmar: () => void; onVolver: () => void;
  destino?: string; onOpcion?: (indice: number) => void; onCantidad?: (delta: number) => void;
}) {
  const conMouse = useConMouse();
  const codigoRef = useRef<HTMLButtonElement>(null);
  const montoRef = useRef<HTMLInputElement>(null);
  useFocoCaja(montoRef, destino);
  const enviar = useCallback(() => {
    if (ocupado) return;
    if (listo) onConfirmar();
    else if (soloCodigo) codigoRef.current?.focus();
  }, [ocupado, listo, soloCodigo, onConfirmar]);
  useTecla((e) => {
    if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.closest("[data-caja-opcion]")) return false;
    if (e.key === "Enter") { enviar(); return true; }
    if (/^[1-9]$/.test(e.key) && onOpcion) { onOpcion(Number(e.key) - 1); return true; }
    if (onCantidad && ["+", "ArrowUp", "-", "−", "ArrowDown"].includes(e.key)) {
      onCantidad(e.key === "+" || e.key === "ArrowUp" ? 1 : -1); return true;
    }
    return false;
  }, { activo: !ocupado });
  useTecla((e) => { if (e.key === "Escape") { onVolver(); return true; } return false; }, { activo: !ocupado, inclusoEnCampos: true });
  const alTeclaFormulario = (e: ReactKeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    if (e.repeat) { e.preventDefault(); return; }
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    const campo = e.target;
    if (campo instanceof HTMLElement && campo.tagName === "TEXTAREA") return;
    if (campo instanceof HTMLElement && ["INPUT", "SELECT"].includes(campo.tagName)) {
      e.preventDefault(); enviar();
    }
  };
  return { conMouse, codigoRef, montoRef, enviar, alTeclaFormulario };
}