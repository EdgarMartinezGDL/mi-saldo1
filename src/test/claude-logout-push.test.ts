// Claude: H3 del comité (2026-11-20). Cerrar sesión da de baja las notificaciones de este navegador.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ api: vi.fn(), orden: [] as string[], unsubscribe: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api, setSesion: vi.fn() }));
vi.mock("@/lib/sin-conexion-sesion", () => ({ terminarCopia: vi.fn() }));

import { logout } from "@/lib/api/auth";

function conSuscripcion(sub: { endpoint: string; unsubscribe: () => Promise<boolean> } | null) {
  const reg = { active: {}, pushManager: { getSubscription: async () => sub } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => reg } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: class {} });
}

describe("cerrar sesión y notificaciones", () => {
  beforeEach(() => {
    vi.resetAllMocks(); m.orden = [];
    m.api.mockImplementation(async (path: string) => { m.orden.push(path); return undefined; });
    m.unsubscribe.mockImplementation(async () => { m.orden.push("unsubscribe"); return true; });
  });

  it("da de baja la suscripción de este navegador ANTES de cerrar la sesión", async () => {
    conSuscripcion({ endpoint: "https://fcm.googleapis.com/fcm/send/x", unsubscribe: m.unsubscribe });
    await logout();
    expect(m.orden).toEqual(["unsubscribe", "/api/push/suscripciones/baja", "/api/auth/logout"]);
    expect(m.api).toHaveBeenCalledWith("/api/push/suscripciones/baja", { method: "POST", body: { endpoint: "https://fcm.googleapis.com/fcm/send/x" } });
  });

  it("sin notificaciones activas, cierra la sesión igual", async () => {
    conSuscripcion(null);
    await logout();
    expect(m.orden).toEqual(["/api/auth/logout"]);
  });

  it("si la baja falla (sin red), el cierre de sesión sigue", async () => {
    conSuscripcion({ endpoint: "https://fcm.googleapis.com/fcm/send/x", unsubscribe: m.unsubscribe });
    m.api.mockImplementation(async (path: string) => { m.orden.push(path); if (path.includes("baja")) throw new Error("sin red"); });
    await logout();
    expect(m.orden).toEqual(["unsubscribe", "/api/push/suscripciones/baja", "/api/auth/logout"]);
  });
});
