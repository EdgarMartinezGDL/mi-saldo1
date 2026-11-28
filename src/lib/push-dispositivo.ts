import { bajaSuscripcion, llavePublica, registrarSuscripcion, sincronizarSuscripcion } from "@/lib/api/push";
import { esIos, instalada } from "@/lib/instalacion";

export type EstadoPush = "no_disponible" | "instalar_ios" | "bloqueadas" | "desactivadas" | "activadas";

/** Active /sw.js registration, or null when push can't work here (preview, old browser). */
async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg?.active ? reg : null;
}

export async function estadoPush(): Promise<EstadoPush> {
  const reg = await registro();
  if (!reg) return "no_disponible";
  if (esIos() && !instalada()) return "instalar_ios";
  if (Notification.permission === "denied") return "bloqueadas";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "activadas" : "desactivadas";
}

/** base64url (VAPID public key) → bytes for applicationServerKey. */
function base64urlABytes(llave: string): Uint8Array {
  const base64 = llave.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Short, impersonal device label: "Chrome en Android", "Safari en iPhone"… */
function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  const nav = /Edg(e|iOS|A)?\//.test(ua) ? "Edge"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : null;
  const so = /Android/.test(ua) ? "Android"
    : esIos() ? (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iPad" : "iPhone")
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux" : null;
  return nav && so ? `${nav} en ${so}` : nav ?? "Navegador";
}

/** Asks permission (from the button tap), subscribes and registers with the backend. */
export async function activarPush(): Promise<void> {
  const reg = await registro();
  if (!reg) throw new Error("Este dispositivo no admite notificaciones.");
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return;
  const { llave_publica } = await llavePublica();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlABytes(llave_publica) as BufferSource,
  });
  try {
    await registrarSuscripcion(sub.toJSON(), nombreDispositivo());
  } catch (e) {
    await sub.unsubscribe().catch(() => undefined);
    throw e;
  }
}

/** Unsubscribes here first (notices stop even if the network fails), then tells the backend. */
export async function desactivarPush(): Promise<void> {
  const reg = await registro();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await sub.unsubscribe();
  await bajaSuscripcion(sub.endpoint).catch(() => undefined);
}

/**
 * Claude (0076): notices follow the server session. After signing in, a browser
 * that was already subscribed re-links its subscription to the new session.
 * If the server says it isn't this person's (another account on a shared phone)
 * or it no longer exists, unsubscribe here so "Notificaciones activadas" stays
 * truthful. Silent: never breaks sign-in.
 */
export async function sincronizarPush(): Promise<void> {
  try {
    const reg = await registro();
    if (!reg || Notification.permission !== "granted") return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { sincronizada } = await sincronizarSuscripcion(sub.endpoint);
    if (!sincronizada) await sub.unsubscribe();
  } catch {
    // Offline or old backend: try again on the next sign-in.
  }
}
