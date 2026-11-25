import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CajaProvider, type CajaCtx } from "@/components/caja/caja-contexto";
import { PasoFicha } from "@/components/caja/paso-ficha";
import { AppShell } from "@/components/app-shell";
import { MiSaldoProvider } from "@/components/misaldo-provider";
import { Route as PanelRoute } from "@/routes/panel";
import inicio from "@/routes/index.tsx?raw";

const m = vi.hoisted(() => ({ api: vi.fn(), rec: 0, sol: 0, validaciones: 0, sinPin: false, rol: "dueno" }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", conectado: true, sesion: { contexto: { rol: m.rol, negocio_id: "cafe", nombre_comercial: "Café & Pan" } } }) }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => ({}), PendientesAsistente: () => null }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => vi.fn(), useRouterState: () => "/panel", Link: ({ to, search: _search, children, ...props }: { to: string; search?: unknown; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ varios: false }) }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({}) }));
vi.mock("@/components/aviso-pendiente", () => ({ AvisoPendiente: () => null }));
vi.mock("@/lib/use-mis-validaciones", () => ({ useMisValidaciones: () => ({ data: { validaciones: Array.from({ length: m.validaciones }, () => ({ estado: "pendiente" })) } }) }));

const clients: QueryClient[] = [];
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}><MiSaldoProvider>{children}</MiSaldoProvider></QueryClientProvider>);
}
const Panel = (PanelRoute as unknown as { options: { component: ComponentType } }).options.component;
beforeEach(() => {
  vi.clearAllMocks(); m.rec = 0; m.sol = 0; m.validaciones = 0; m.sinPin = false; m.rol = "dueno";
  m.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/dashboard")) return { periodo: { hasta: "2026-11-24" }, monedero: null, tarjetas: null, clientes: { atendidos: 3, altas: 1, activos_total: 57, archivados_total: 0, bajas: 0 }, reclamaciones: { pendientes: m.rec }, validaciones_alta: { pendientes: m.sol }, cajeros: [], serie: [] };
    if (path === "/api/negocio/membresia") return {};
    if (path === "/api/negocio/configuracion") return { negocio: { negocio_id: "cafe", nombre_comercial: "Café & Pan", logo_url: null, pin_pos_configurado: !m.sinPin } };
    if (path === "/api/registro/mi-codigo") return { codigo: "ABC123" };
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

const antes = (a: HTMLElement, b: HTMLElement) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Inicio del cliente", () => {
  it("ya no repite el negocio en una pastilla junto a 'Hola de nuevo'", () => {
    const saludo = inicio.slice(inicio.indexOf("Hola de nuevo"), inicio.indexOf("<InvitarInstalar />"));
    expect(saludo).not.toContain("nombre_comercial");
    expect(saludo).not.toContain("rounded-full");
  });
});

describe("U-01 Caja en celular", () => {
  const ctx: CajaCtx = {
    config: { negocio: { negocio_id: "cafe", nombre_comercial: "Café & Pan", logo_url: null, moneda: "MXN", pin_pos_configurado: true, membresia_estado: "activa" }, modulos: ["monedero"], modulos_en_retiro: [], monedero: { factor_cashback: .1, vigencia_dias: null, actualizado_en: "2026-11-21" } },
    moneda: "MXN", zona: "America/Mexico_City", rol: "dueno", ejecutar: (fn) => fn(), recargarConfig: () => {},
  };
  it("los botones van antes del saldo, y el correo al final", () => {
    montar(<CajaProvider valor={ctx}><PasoFicha ficha={{ cliente: { persona_id: "nora", nombre: "Nora", apellido_paterno: null, cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true, correo: { estado: "sin_correo", enmascarado: null } }, monedero: { saldo_centavos: 5000, fecha_vencimiento: null, acumula: true } }} onAccion={vi.fn()} onVolver={vi.fn()} onRefrescar={async () => {}} /></CajaProvider>);
    const acumular = screen.getByRole("button", { name: /Acumular/ });
    const saldo = screen.getByText("Saldo");
    const correo = screen.getByRole("button", { name: "Agregar correo" });
    expect(antes(acumular, saldo)).toBe(true);
    expect(antes(saldo, correo)).toBe(true);
    expect(acumular.parentElement).toHaveClass("lg:order-last");
  });
});

describe("U-04 Para atender hoy", () => {
  it("en 0 no ocupa lugar y ya no hay tarjetas de pendientes", async () => {
    montar(<Panel />);
    await screen.findByText("Cómo va tu negocio hoy.");
    expect(screen.queryByRole("heading", { name: "Para atender hoy" })).toBeNull();
    expect(screen.queryByText("Reclamaciones pendientes")).toBeNull();
    expect(screen.queryByText("Solicitudes de alta")).toBeNull();
  });
  it("muestra solo lo que tiene pendientes, con su enlace", async () => {
    m.rec = 2; m.validaciones = 1; montar(<Panel />);
    await screen.findByRole("heading", { name: "Para atender hoy" });
    expect(screen.getByRole("link", { name: /2 reclamaciones por revisar/ })).toHaveAttribute("href", "/negocio/reclamaciones");
    expect(screen.getByRole("link", { name: /1 solicitud por confirmar/ })).toHaveAttribute("href", "/validaciones");
    expect(screen.queryByRole("link", { name: /solicitud.* de alta/ })).toBeNull();
  });
});

describe("U-07 ventas y atendidos abren Movimientos", () => {
  it("las tarjetas de ventas y de clientes atendidos llevan a Movimientos de hoy", async () => {
    montar(<Panel />);
    expect(await screen.findByRole("link", { name: /Ventas de hoy/ })).toHaveAttribute("href", "/negocio/movimientos");
    expect(screen.getByRole("link", { name: /Clientes atendidos/ })).toHaveAttribute("href", "/negocio/movimientos");
  });
});

describe("U-05 globito en la pestaña Negocio", () => {
  it("suma reclamaciones, solicitudes y el PIN POS sin definir", async () => {
    m.rec = 1; m.sol = 2; m.sinPin = true; montar(<AppShell>Panel</AppShell>);
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Negocio, 4 pendientes" })).toHaveLength(2));
  });
  it("sin pendientes no hay globito", async () => {
    montar(<AppShell>Panel</AppShell>);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/negocio/configuracion"));
    expect(screen.queryByRole("link", { name: /pendiente/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Negocio" }).length).toBeGreaterThan(0);
  });
  it("el empleado no consulta los pendientes del dueño", async () => {
    m.rol = "empleado"; montar(<AppShell>Caja</AppShell>);
    await waitFor(() => expect(m.api).toHaveBeenCalled());
    expect(m.api.mock.calls.some(([p]) => String(p).startsWith("/api/dashboard"))).toBe(false);
  });
});
