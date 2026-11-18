import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { NotificacionesDispositivo } from "@/components/cuenta/secciones";

const m = vi.hoisted(() => ({ api: vi.fn(), estado: vi.fn(), success: vi.fn(), error: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/lib/push-dispositivo", () => ({ estadoPush: m.estado, activarPush: vi.fn(), desactivarPush: vi.fn() }));
vi.mock("@/components/cuenta/cuenta-api", async (original) => ({ ...await original<typeof import("@/components/cuenta/cuenta-api")>(), promociones: async () => ({ acepta_promociones: false }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><NotificacionesDispositivo /></QueryClientProvider>);
  return client;
}

function pendiente<T>() {
  let resolver: (value: T) => void = () => { throw new Error("Promesa no inicializada"); };
  let rechazar: (error: Error) => void = () => { throw new Error("Promesa no inicializada"); };
  const promise = new Promise<T>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promise, resolver, rechazar };
}

beforeEach(() => { vi.resetAllMocks(); m.estado.mockResolvedValue("activadas"); m.api.mockResolvedValue({ movimientos: true, vencimientos: false }); });
afterEach(cleanup);

describe("P35 preferencias push", () => {
  it.each([404, 500])("oculta la sección ante GET %s sin error visible y conserva Desactivar", async (status) => {
    m.api.mockRejectedValue(new ApiError(status, {}));
    const client = montar();
    await screen.findByRole("button", { name: "Desactivar" });
    await waitFor(() => expect(client.getQueryState(["push-preferencias"])?.status).toBe("error"));
    expect(screen.queryByRole("switch")).toBeNull();
    expect(m.error).not.toHaveBeenCalled();
    expect(m.api).toHaveBeenCalledTimes(1);
  });

  it("lee ambos valores de la respuesta", async () => {
    montar();
    expect(await screen.findByRole("switch", { name: "Compras y canjes" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Vencimientos" })).toHaveAttribute("aria-checked", "false");
    expect(m.api).toHaveBeenCalledWith("/api/push/preferencias");
  });

  it("guarda solo movimientos, bloquea ambos y conserva la respuesta en caché", async () => {
    const client = montar();
    const compras = await screen.findByRole("switch", { name: "Compras y canjes" });
    const guardar = pendiente<{ movimientos: boolean; vencimientos: boolean }>();
    m.api.mockReturnValueOnce(guardar.promise);
    fireEvent.click(compras);
    expect(m.api).toHaveBeenLastCalledWith("/api/push/preferencias", { method: "PUT", body: { movimientos: false } });
    expect(compras).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Vencimientos" })).toBeDisabled();
    guardar.resolver({ movimientos: false, vencimientos: true });
    await waitFor(() => expect(compras).toBeEnabled());
    expect(compras).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Vencimientos" })).toHaveAttribute("aria-checked", "true");
    expect(client.getQueryData(["push-preferencias"])).toEqual({ movimientos: false, vencimientos: true });
    expect(m.success).toHaveBeenCalledWith("Listo, guardamos tu preferencia");
  });

  it("revierte movimientos si PUT falla y muestra el error compartido", async () => {
    montar();
    const compras = await screen.findByRole("switch", { name: "Compras y canjes" });
    const guardar = pendiente<never>();
    m.api.mockReturnValueOnce(guardar.promise);
    fireEvent.click(compras);
    expect(compras).toHaveAttribute("aria-checked", "false");
    const error = new ApiError(500, {});
    guardar.rechazar(error);
    await waitFor(() => expect(compras).toBeEnabled());
    expect(compras).toHaveAttribute("aria-checked", "true");
    expect(m.error).toHaveBeenCalledWith(error.message, { description: undefined });
    expect(m.success).not.toHaveBeenCalled();
  });

  it("no consulta preferencias con push desactivado", async () => {
    m.estado.mockResolvedValue("desactivadas");
    montar();
    await screen.findByRole("button", { name: /Activar notificaciones/ });
    expect(m.api).not.toHaveBeenCalled();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("no muestra preferencias mientras GET está pendiente", async () => {
    const consulta = pendiente<never>();
    m.api.mockReturnValue(consulta.promise);
    montar();
    await screen.findByRole("button", { name: "Desactivar" });
    expect(screen.queryByRole("switch")).toBeNull();
    expect(m.error).not.toHaveBeenCalled();
  });

  it("envía únicamente vencimientos al cambiar esa preferencia", async () => {
    montar();
    const vencimientos = await screen.findByRole("switch", { name: "Vencimientos" });
    m.api.mockResolvedValueOnce({ movimientos: true, vencimientos: true });
    fireEvent.click(vencimientos);
    await waitFor(() => expect(vencimientos).toBeEnabled());
    expect(m.api).toHaveBeenLastCalledWith("/api/push/preferencias", { method: "PUT", body: { vencimientos: true } });
    expect(vencimientos).toHaveAttribute("aria-checked", "true");
  });
});