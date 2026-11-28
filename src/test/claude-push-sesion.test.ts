// Claude: 0076 (push ligado a la sesión, 2026-11-27). Al entrar, el navegador que ya
// estaba suscrito se liga a la sesión nueva; si el servidor dice que no es de esta
// persona, se da de baja aquí para no mostrar "activadas" sin recibir nada.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ api: vi.fn(), setSesion: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api, setSesion: m.setSesion }));
vi.mock("@/lib/sin-conexion-sesion", () => ({ terminarCopia: vi.fn() }));

import { login } from "@/lib/api/auth";
import { sincronizarPush } from "@/lib/push-dispositivo";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/x";
const SINCRONIZAR = "/api/push/suscripciones/sincronizar";

function navegador(sub: { endpoint: string; unsubscribe: () => Promise<boolean> } | null, permiso = "granted") {
  const reg = { active: {}, pushManager: { getSubscription: async () => sub } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => reg } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: permiso } });
}
const llamadasA = (ruta: string) => m.api.mock.calls.filter(([p]) => p === ruta);

describe("notificaciones ligadas a la sesión (0076)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.unsubscribe.mockResolvedValue(true);
  });

  it("con suscripción propia: la sincroniza y no la da de baja", async () => {
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe });
    m.api.mockResolvedValue({ sincronizada: true });
    await sincronizarPush();
    expect(m.api).toHaveBeenCalledWith(SINCRONIZAR, { method: "POST", body: { endpoint: ENDPOINT } });
    expect(m.unsubscribe).not.toHaveBeenCalled();
  });

  it("si no es de esta persona (o ya no existe): se da de baja en este navegador", async () => {
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe });
    m.api.mockResolvedValue({ sincronizada: false });
    await sincronizarPush();
    expect(m.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("sin suscripción o sin permiso: no llama al servidor", async () => {
    navegador(null);
    await sincronizarPush();
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe }, "default");
    await sincronizarPush();
    expect(llamadasA(SINCRONIZAR)).toHaveLength(0);
  });

  it("si el servidor falla (sin red, backend viejo): no rompe nada ni da de baja", async () => {
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe });
    m.api.mockRejectedValue(new Error("sin red"));
    await expect(sincronizarPush()).resolves.toBeUndefined();
    expect(m.unsubscribe).not.toHaveBeenCalled();
  });

  it("al iniciar sesión se sincroniza sola", async () => {
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe });
    m.api.mockImplementation(async (path: string) =>
      path === "/api/auth/login"
        ? { estado: "autenticado", access_token: "t", token_type: "Bearer", expires_in: 900, sesion_expira_en: "", contexto: { rol: "cliente", negocio_id: "n", nombre_comercial: "N" } }
        : { sincronizada: true });
    await login("+525500000099", "135790");
    await vi.waitFor(() => expect(llamadasA(SINCRONIZAR)).toHaveLength(1));
    expect(m.setSesion).toHaveBeenCalledTimes(1);
  });

  it("si el login pide elegir negocio, todavía no sincroniza", async () => {
    navegador({ endpoint: ENDPOINT, unsubscribe: m.unsubscribe });
    m.api.mockResolvedValue({ estado: "seleccionar_contexto", token_seleccion: "x", contextos: [] });
    await login("+525500000099", "135790");
    await new Promise((r) => setTimeout(r, 0));
    expect(llamadasA(SINCRONIZAR)).toHaveLength(0);
  });
});
