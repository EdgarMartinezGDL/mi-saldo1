import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiArchivo, ApiError, onSesion, onSinConexion, refrescar, type Sesion } from "@/lib/api/client";
import { actualizarCopia, leerCopia } from "@/lib/sin-conexion-storage";
import { guardarCopia, prepararCopia, terminarCopia } from "@/lib/sin-conexion-sesion";

const sesion: Sesion = { access_token: "token-de-prueba", token_type: "Bearer", expires_in: 900, sesion_expira_en: "2026-11-17T00:00:00Z", contexto: { rol: "cliente", negocio_id: "barberia", nombre_comercial: "Barbería" } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  actualizarCopia({ persona_id: "diego", nombre: "Diego" }, { codigo: "4729" });
});
afterEach(() => {
  terminarCopia();
  onSesion(() => {});
  onSinConexion(() => {});
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("P27 sesión rechazada y copia sin conexión", () => {
  it("borra la copia cuando el refresco responde 401 y emite sesión null", async () => {
    const listener = vi.fn();
    onSesion(listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ codigo: "sesion_invalida" }, 401)));
    await expect(refrescar()).resolves.toBeNull();
    expect(leerCopia()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it("conserva la copia y avisa sin conexión si el refresco falla por red", async () => {
    const offline = vi.fn();
    onSinConexion(offline);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(refrescar()).rejects.toBeInstanceOf(ApiError);
    await expect(refrescar()).rejects.toMatchObject({ status: 0 });
    expect(offline).toHaveBeenCalled();
    expect(leerCopia()?.nombre).toBe("Diego");
  });

  it("conserva la copia sin llamar fetch cuando navigator está sin red", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(refrescar()).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(leerCopia()?.nombre).toBe("Diego");
  });

  it.each([500, 502, 503, 429])("conserva la copia si el refresco responde %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, status)));
    await expect(refrescar()).resolves.toBeNull();
    expect(leerCopia()?.nombre).toBe("Diego");
  });

  it("borra la copia con el segundo 401 de api", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json(sesion))
      .mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/api/cliente/resumen")).rejects.toMatchObject({ status: 401, codigo: "sesion_expirada" });
    expect(leerCopia()).toBeNull();
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(["/api/cliente/resumen", "/api/auth/refrescar", "/api/cliente/resumen"]);
  });

  it("borra la copia con el segundo 401 de apiArchivo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json(sesion))
      .mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiArchivo("/api/negocio/exportaciones/historial/descarga", {})).rejects.toMatchObject({ status: 401, codigo: "sesion_expirada" });
    expect(leerCopia()).toBeNull();
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(["/api/negocio/exportaciones/historial/descarga", "/api/auth/refrescar", "/api/negocio/exportaciones/historial/descarga"]);
  });

  it.each(["refrescar", "api"] as const)("una escritura pendiente no revive la copia tras el 401 de %s", async (via) => {
    const pendientes: Array<() => void> = [];
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/auth/sesion" || path === "/api/perfil") {
        return new Promise<Response>((resolve) => {
          pendientes.push(() => resolve(json(path === "/api/auth/sesion"
            ? { persona_id: "diego", rol: "cliente", negocio_id: "barberia" }
            : { nombre: "Diego" })));
        });
      }
      if (path === "/api/auth/refrescar") return Promise.resolve(via === "api" ? json(sesion) : json({ codigo: "sesion_invalida" }, 401));
      return Promise.resolve(json({}, 401));
    });
    vi.stubGlobal("fetch", fetchMock);
    // The real session listener invalidates pending writes before deletion.
    onSesion(prepararCopia);
    prepararCopia(sesion);
    const escritura = guardarCopia({ codigo: "1111" });
    expect(pendientes).toHaveLength(1);
    expect(leerCopia()?.codigo_acumulacion).toBe("4729");
    if (via === "api") {
      await expect(api("/api/cliente/resumen")).rejects.toMatchObject({ status: 401, codigo: "sesion_expirada" });
    } else {
      await expect(refrescar()).resolves.toBeNull();
    }
    expect(leerCopia()).toBeNull();
    for (const resolver of pendientes) resolver();
    await escritura;
    expect(leerCopia()).toBeNull();
  });

  it("conserva la copia con un 403 sin refrescar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 403));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/api/cliente/resumen")).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(leerCopia()?.nombre).toBe("Diego");
  });
});