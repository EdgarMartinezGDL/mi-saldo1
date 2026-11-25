// Claude (2026-11-24): hallazgos del propietario al revisar en el celular.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ReportesRoute } from "@/routes/negocio.reportes";
import operacion from "@/components/negocio/operacion-ui.tsx?raw";

const m = vi.hoisted(() => ({ contar: vi.fn(), descargar: vi.fn() }));
vi.mock("@/lib/api/marketing", () => ({ contarReporte: m.contar, descargarReporte: m.descargar }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), guardarArchivo: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }), useNavigate: () => vi.fn(), Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/negocio/comun", () => ({
  SeccionNegocio: ({ descripcion, children }: { descripcion?: string; children: ReactNode }) => <div><p>{descripcion}</p>{children}</div>,
  ConConfig: ({ children }: { children: (c: unknown) => ReactNode }) => <>{children({ negocio: { nombre_comercial: "Tortas Leah" } })}</>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const Reportes = (ReportesRoute as unknown as { options: { component: ComponentType } }).options.component;
function montar() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Reportes /></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); m.descargar.mockResolvedValue(new Blob()); });
afterEach(cleanup);
const tarjeta = (titulo: string) => screen.getByRole("heading", { name: titulo }).closest("section") as HTMLElement;

describe("Reportes: Descargar Excel siempre a la vista", () => {
  it("antes de contar se ve desactivado y explica el paso", () => {
    montar();
    expect(screen.getByText(/Descarga un Excel con un botón de WhatsApp por cliente/)).toBeInTheDocument();
    const c = within(tarjeta("Cumpleañeros"));
    const descargar = c.getByRole("button", { name: /Descargar Excel/ });
    expect(descargar).toBeDisabled();
    expect(descargar).toHaveAccessibleDescription(/Primero toca Contar/);
    expect(within(tarjeta("Inactivos")).getByRole("button", { name: /Descargar Excel/ })).toBeDisabled();
  });
  it("con 0 clientes sigue desactivado; con 1 o más se activa y descarga", async () => {
    m.contar.mockResolvedValueOnce({ conteo: 0, excede_limite: false });
    montar();
    const c = within(tarjeta("Inactivos"));
    fireEvent.click(c.getByRole("button", { name: /Contar/ }));
    expect(await c.findByText("No hay clientes en ese rango")).toBeInTheDocument();
    expect(c.getByRole("button", { name: /Descargar Excel/ })).toBeDisabled();
    m.contar.mockResolvedValueOnce({ conteo: 2, excede_limite: false });
    fireEvent.click(c.getByRole("button", { name: /Contar/ }));
    await waitFor(() => expect(c.getByRole("button", { name: /Descargar Excel/ })).toBeEnabled());
    fireEvent.click(c.getByRole("button", { name: /Descargar Excel/ }));
    await waitFor(() => expect(m.descargar).toHaveBeenCalledWith("inactivos", expect.any(Object)));
  });
  it("Contar ya no usa el estilo gris que parecía desactivado", () => {
    montar();
    const contar = within(tarjeta("Cumpleañeros")).getByRole("button", { name: /Contar/ });
    expect(contar).toHaveClass("border-primary");
    expect(contar).not.toHaveClass("bg-secondary");
  });
});

describe("Mensaje de WhatsApp en celular", () => {
  it("es de 4 líneas y se centra al tocarlo para que la barra de abajo no lo tape", () => {
    expect(operacion).toContain("rows={4}");
    expect(operacion).toContain('scrollIntoView?.({ block: "center"');
  });
});
