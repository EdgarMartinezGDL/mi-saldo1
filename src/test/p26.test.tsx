import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api/client";

const saturado = (retryAfter?: string) =>
  new Response(JSON.stringify({ codigo: "servicio_saturado" }), {
    status: 503,
    headers: {
      "content-type": "application/json",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    },
  });

const ok = (cuerpo: unknown = { listo: true }) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json" } });

const MENSAJE_SATURADO =
  "Hay mucha actividad en este momento. Espera unos segundos e intenta de nuevo; no se hizo ningún cargo doble.";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("P26 reintento por servicio_saturado", () => {
  it("reintenta tras 503 servicio_saturado con el mismo método, ruta y body", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(saturado()).mockResolvedValueOnce(ok({ saldo: 100 }));
    vi.stubGlobal("fetch", fetchMock);

    const promesa = api<{ saldo: number }>("/api/monedero/acumular", {
      method: "POST",
      body: { monto: 100, idempotency_key: "llave-1" },
    });
    await vi.advanceTimersByTimeAsync(5500);
    await expect(promesa).resolves.toEqual({ saldo: 100 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [ruta1, init1] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [ruta2, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(ruta2).toBe(ruta1);
    expect(init2.method).toBe(init1.method);
    expect(init2.body).toBe(init1.body);
  });

  it("respeta Retry-After: no reintenta antes de 3 s y sí antes de 3.5 s", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(saturado("3")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    const promesa = api("/api/prueba");
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(501);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(promesa).resolves.toEqual({ listo: true });
  });

  it("topa la espera en 5 s aunque Retry-After pida 60", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(saturado("60")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);

    const promesa = api("/api/prueba");
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(501);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(promesa).resolves.toEqual({ listo: true });
  });

  it("tras tres 503 seguidos rechaza con ApiError 503 servicio_saturado y su mensaje", async () => {
    const fetchMock = vi.fn().mockResolvedValue(saturado());
    vi.stubGlobal("fetch", fetchMock);

    const promesa = api("/api/prueba");
    const espera = expect(promesa).rejects.toMatchObject({
      status: 503,
      codigo: "servicio_saturado",
      message: MENSAJE_SATURADO,
    });
    await vi.advanceTimersByTimeAsync(5500);
    await vi.advanceTimersByTimeAsync(5500);
    await espera;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([{}, { codigo: "otro" }])("no reintenta un 503 sin el código servicio_saturado", async (cuerpo) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(cuerpo), { status: 503, headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/api/prueba")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un 503 con cuerpo que no es JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 503, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/api/prueba")).rejects.toMatchObject({ status: 502, codigo: "respuesta_invalida" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502, 429, 422])("no reintenta un %i", async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ codigo: "servicio_saturado" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/api/prueba")).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si el reintento falla por red, rechaza con ApiError 0 sin_conexion", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(saturado()).mockRejectedValueOnce(new TypeError("network"));
    vi.stubGlobal("fetch", fetchMock);

    const promesa = api("/api/prueba");
    const espera = expect(promesa).rejects.toMatchObject({ status: 0, codigo: "sin_conexion" });
    await vi.advanceTimersByTimeAsync(5500);
    await espera;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
