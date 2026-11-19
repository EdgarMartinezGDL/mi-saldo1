import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import clientes from "@/routes/clientes.tsx?raw";
import marca from "@/components/marca.tsx?raw";
import asistente from "@/components/negocio/asistente.tsx?raw";
import membresia from "@/components/membresia.tsx?raw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificacionesDispositivo } from "@/components/cuenta/secciones";
import { BotonQrRegistro } from "@/components/qr-registro";
import { ApiError } from "@/lib/api/client";

const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/lib/push-dispositivo", () => ({ estadoPush: async () => "activadas", activarPush: vi.fn(), desactivarPush: vi.fn() }));
vi.mock("@/components/cuenta/cuenta-api", async (original) => ({ ...await original<typeof import("@/components/cuenta/cuenta-api")>(), promociones: async () => ({ acepta_promociones: false }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "dueno", nombre_comercial: "Café 100% natural" } } }) }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg aria-label="Código QR de registro" data-value={value} /> }));

const clients: QueryClient[] = [];
function montar(children: ReactNode, key: string, data?: object) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  if (data) client.setQueryData([key], data, { updatedAt: Date.now() - 6 * 60_000 });
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
  return client;
}
beforeEach(() => { vi.resetAllMocks(); m.api.mockReturnValue(new Promise(() => {})); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("P36b datos ya cargados", () => {
  it("mantiene preferencias durante una recarga en curso", async () => {
    const client = montar(<NotificacionesDispositivo />, "push-preferencias", { movimientos: true, vencimientos: false });
    await screen.findByRole("switch", { name: "Compras y canjes" });
    await waitFor(() => expect(client.getQueryState(["push-preferencias"])?.fetchStatus).toBe("fetching"));
    expect(screen.getByRole("heading", { name: "¿De qué te avisamos?" })).toBeVisible();
    expect(screen.getByRole("switch", { name: "Compras y canjes" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Vencimientos" })).toHaveAttribute("aria-checked", "false");
  });
  it("mantiene las preferencias después de un error de recarga", async () => {
    m.api.mockRejectedValue(new ApiError(500, {}));
    const client = montar(<NotificacionesDispositivo />, "push-preferencias", { movimientos: false, vencimientos: true });
    await waitFor(() => expect(client.getQueryState(["push-preferencias"])?.status).toBe("error"));
    expect(screen.getByRole("switch", { name: "Compras y canjes" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Vencimientos" })).toHaveAttribute("aria-checked", "true");
  });
  it.each([true, false])("QR durante recarga conserva éxito previo=%s", async (previo) => {
    const client = montar(<BotonQrRegistro />, "mi-codigo-registro", previo ? { codigo: "ABC123" } : undefined);
    await waitFor(() => expect(client.getQueryState(["mi-codigo-registro"])?.fetchStatus).toBe("fetching"));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/${previo ? "registro#c=ABC123" : "bienvenida#n=Caf%C3%A9%20100%25%20natural"}`);
    fireEvent.keyDown(window, { key: "Escape" });
  });
  it("QR conserva código previo después de un error de recarga", async () => {
    m.api.mockRejectedValue(new ApiError(500, {}));
    const client = montar(<BotonQrRegistro />, "mi-codigo-registro", { codigo: "ABC123" });
    await waitFor(() => expect(client.getQueryState(["mi-codigo-registro"])?.status).toBe("error"));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/registro#c=ABC123`);
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {});
  });
});

describe("P36b clases solicitadas", () => {
  it("Sin activar conserva su altura con text-xs", () => {
    expect(clientes).toContain('className="pill-badge shrink-0 py-0.5 text-xs leading-4 text-warning-etiqueta">Sin activar');
  });
  it("Vip tiene una sola regla de tamaño con mínimo de 12 px", () => {
    expect(marca).toContain("text-[max(12px,0.7em)]");
    expect(marca).not.toContain("text-[0.7em]");
    expect(marca).not.toContain("[font-size:");
  });
  it("etiqueta del Asistente usa secondary-foreground", () => {
    expect(asistente).toContain('className="pill-badge text-secondary-foreground"');
  });
  it("etiquetas mayúsculas de Membresía usan secondary-foreground", () => {
    expect(membresia.match(/text-xs uppercase tracking-wide text-secondary-foreground/g)).toHaveLength(2);
    expect(membresia).not.toContain("text-xs uppercase tracking-wide text-muted-foreground");
  });
});