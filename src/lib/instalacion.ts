import { useSyncExternalStore } from "react";

export const esIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const instalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const llave = "misaldo-invitar-instalar";
let evento: BeforeInstallPromptEvent | null = null;
let escuchando = false;
let cerrado = false;
let version = 0;
const oyentes = new Set<() => void>();
const avisar = () => { version += 1; oyentes.forEach((fn) => fn()); };
const suscribir = (fn: () => void) => { oyentes.add(fn); return () => { oyentes.delete(fn); }; };

export function instalacionCerrada() {
  try { return cerrado || localStorage.getItem(llave) === "cerrado"; }
  catch { return cerrado; }
}

export function cerrarInstalacion() {
  cerrado = true;
  try { localStorage.setItem(llave, "cerrado"); } catch { /* Preferencia en memoria. */ }
  avisar();
}

export function escucharInstalacion() {
  if (typeof window === "undefined" || escuchando) return;
  escuchando = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evento = e as BeforeInstallPromptEvent;
    avisar();
  });
  window.addEventListener("appinstalled", () => { evento = null; cerrarInstalacion(); });
}

async function instalar(): Promise<"aceptada" | "rechazada" | "no_disponible"> {
  const pendiente = evento;
  if (!pendiente) return "no_disponible";
  evento = null;
  try {
    await pendiente.prompt();
    const eleccion = await pendiente.userChoice;
    if (eleccion.outcome === "accepted") { cerrarInstalacion(); return "aceptada"; }
    return "rechazada";
  } catch { return "no_disponible"; }
  finally { avisar(); }
}

export function useInstalacion() {
  useSyncExternalStore(suscribir, () => version, () => 0);
  return { puedeInstalar: evento !== null, instalar };
}