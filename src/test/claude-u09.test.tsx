import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as PanelRoute } from "@/routes/panel";

const m = vi.hoisted(() => ({ api: vi.fn(), tarjetas: null as null | { sellos_otorgados: number } }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", conectado: true, sesion: { contexto: { rol: "dueno", negocio_id: "cafe", nombre_comercial: "Café & Pan" } } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => ({}), PendientesAsistente: () => null }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => vi.fn(), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/lib/use-mis-validaciones", () => ({ useMisValidaciones: () => ({ data: { validaciones: [] } }) }));

const Panel = (PanelRoute as unknown as { options: { component: ComponentType } }).options.component;
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks(); m.tarjetas = null;
  m.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/dashboard")) {
      const tarjetas = m.tarjetas && { ventas: { monto_compra_centavos: 0, operaciones: 0 }, sellos_otorgados: m.tarjetas.sellos_otorgados, tarjetas_completadas: 0, premios_canjeados: 0 };
      return { periodo: { hasta: "2026-11-25" }, monedero: { ventas: { monto_compra_centavos: 0, operaciones: 0 }, cashback_otorgado_centavos: 0, canjes: { monto_centavos: 0, operaciones: 0 } }, tarjetas, clientes: { atendidos: 3, altas: 1, activos_total: 57, archivados_total: 4, bajas: 0 }, reclamaciones: { pendientes: 0 }, validaciones_alta: { pendientes: 0 }, cajeros: [], serie: [] };
    }
    if (path === "/api/negocio/membresia") return {};
    if (path === "/api/negocio/configuracion") return { negocio: { pin_pos_configurado: true } };
    if (path === "/api/registro/mi-codigo") return { codigo: "ABC123" };
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });
function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}><Panel /></QueryClientProvider>);
}

describe("U-09 Panel más corto", () => {
  it("sin tarjetas de sellos no sale 'Sellos entregados'", async () => {
    montar(); await screen.findByText("Clientes atendidos");
    expect(screen.queryByText("Sellos entregados")).toBeNull();
  });
  it("con tarjetas de sellos sí sale, con su número", async () => {
    m.tarjetas = { sellos_otorgados: 7 }; montar();
    const etiqueta = await screen.findByText("Sellos entregados");
    expect(etiqueta.parentElement).toHaveTextContent("7");
  });
  it("'Clientes en total' y 'Clientes archivados' ya no están en el Panel", async () => {
    montar(); await screen.findByText("Clientes atendidos");
    expect(screen.queryByText("Clientes en total")).toBeNull();
    expect(screen.queryByText("Clientes archivados")).toBeNull();
  });
});
