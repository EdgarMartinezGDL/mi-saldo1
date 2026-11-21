import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ClientesRoute } from "@/routes/clientes";
import { esClienteNuevo } from "@/lib/api/formato";
import { ApiError } from "@/lib/api/client";
import type { ClienteLista } from "@/lib/api/dueno";
import { CajaProvider, type CajaCtx } from "@/components/caja/caja-contexto";
import { PasoFicha } from "@/components/caja/paso-ficha";

const m = vi.hoisted(() => ({ api: vi.fn(), consultar: vi.fn(), navigate: vi.fn(), search: {} as { archivados?: "solo" | "incluir" }, sinCodigo: false }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/lib/api/dueno", async (o) => ({ ...await o<typeof import("@/lib/api/dueno")>(), consultarClientes: m.consultar }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: "dueno", nombre_comercial: "Café & Pan" } } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options, useSearch: () => m.search }), useNavigate: () => m.navigate, Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));

const Clientes = (ClientesRoute as unknown as { options: { component: ComponentType } }).options.component;
const clients: QueryClient[] = [];
function montar(children: ReactNode = <Clientes />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
function cliente(nombre: string, dias: number, extra: Partial<ClienteLista> = {}): ClienteLista {
  return { negocio_cliente_id: nombre, nombre, apellido_paterno: null, apellido_materno: null, telefono: "+525512345678", cuenta_activada: true, cliente_desde: new Date(Date.now() - dias * 86_400_000).toISOString(), ultima_compra_en: null, saldo_centavos: 0, premios_por_canjear: null, archivado: false, archivado_en: null, ...extra };
}
beforeEach(() => {
  vi.clearAllMocks(); m.search = {}; m.sinCodigo = false;
  m.consultar.mockResolvedValue({ clientes: [], total: 0, siguiente: null });
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/registro/mi-codigo") { if (m.sinCodigo) throw new ApiError(404, {}); return { codigo: "ABC123" }; }
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });

describe("P45 ventana de siete días", () => {
  const ahora = new Date("2026-11-21T19:57:00Z");
  it.each([
    [3_600_000, true],
    [(6 * 24 + 23) * 3_600_000, true],
    [7 * 86_400_000, false],
    [-3_600_000, false],
  ] as const)("edad de %s ms → %s", (edad, esperado) => {
    expect(esClienteNuevo(new Date(ahora.getTime() - edad).toISOString(), ahora)).toBe(esperado);
  });
});

describe("P45 elegibilidad de clientes nuevos", () => {
  it.each([
    ["Reciente", 2, true, false, true],
    ["Anterior", 30, true, false, false],
    ["Pendiente", 2, false, false, true],
    ["Archivado reciente", 2, true, true, false],
  ] as const)("%s", async (nombre, dias, activada, archivado, nuevo) => {
    m.consultar.mockResolvedValue({ clientes: [cliente(nombre, dias, { cuenta_activada: activada, archivado })], total: 1, siguiente: null });
    montar();
    const fila = (await screen.findByText(nombre)).closest("li");
    if (!fila) throw new Error("Falta el cliente");
    expect(within(fila).queryByText("Nuevo") !== null).toBe(nuevo);
    expect(within(fila).queryByText("Sin activar") !== null).toBe(!activada);
  });
});

describe("P45 invitación de lista vacía", () => {
  it("usa el código disponible y copia el enlace de registro", async () => {
    const copiar = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copiar } });
    montar();
    await screen.findByText("Aún no tienes clientes");
    fireEvent.click(await screen.findByRole("button", { name: "Copiar enlace" }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(`${location.origin}/registro#c=ABC123`));
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Enlace de registro")).toBeNull();
    vi.unstubAllGlobals();
  });
  it("sin código ofrece ir a Caja", async () => {
    m.sinCodigo = true; montar();
    await screen.findByText("Aún no tienes clientes");
    expect(screen.getByRole("link", { name: "Ir a la Caja" })).toHaveAttribute("href", "/caja");
    expect(screen.queryByRole("button", { name: "Copiar enlace" })).toBeNull();
  });
  it("con búsqueda conserva la ampliación a archivados", async () => {
    montar(); await screen.findByText("Aún no tienes clientes");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Nora" } });
    await screen.findByText("No hay clientes que coincidan.");
    fireEvent.click(screen.getByRole("button", { name: "Buscar también en archivados" }));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/clientes", search: { archivados: "incluir" }, replace: true });
  });
  it.each(["solo", "incluir"] as const)("el filtro %s no ofrece la invitación", async (archivados) => {
    m.search = { archivados }; montar();
    await screen.findByText(archivados === "solo" ? "No hay clientes archivados." : "No hay clientes que coincidan.");
    expect(screen.queryByText("Aún no tienes clientes")).toBeNull();
  });
});

it("P45 el cliente sin correo conserva la edición de correo en Caja", async () => {
  const ctx: CajaCtx = {
    config: { negocio: { negocio_id: "cafe", nombre_comercial: "Café & Pan", logo_url: null, moneda: "MXN", pin_pos_configurado: true, membresia_estado: "activa" }, modulos: ["monedero"], modulos_en_retiro: [], monedero: { factor_cashback: .1, vigencia_dias: null, actualizado_en: "2026-11-21" } },
    moneda: "MXN", zona: "America/Mexico_City", rol: "dueno", ejecutar: (fn) => fn(), recargarConfig: () => {},
  };
  montar(<CajaProvider valor={ctx}><PasoFicha ficha={{ cliente: { persona_id: "nora", nombre: "Nora", apellido_paterno: null, cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true, correo: { estado: "sin_correo", enmascarado: null } }, monedero: { saldo_centavos: 5000, fecha_vencimiento: null, acumula: true } }} onAccion={vi.fn()} onVolver={vi.fn()} onRefrescar={async () => {}} /></CajaProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Agregar correo" }));
  expect(screen.getByLabelText("Correo del cliente")).toBeInTheDocument();
});