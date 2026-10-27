import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ClientesRoute } from "@/routes/clientes";
import { Route as PanelRoute } from "@/routes/panel";
import { Route as ReportesRoute } from "@/routes/negocio.reportes";
import type { ClienteLista, FichaCliente, Dashboard } from "@/lib/api/dueno";
import { diaDeInstante } from "@/lib/api/formato";

const m = vi.hoisted(() => ({ search: {} as { archivados?: "incluir" | "solo" }, navigate: vi.fn(), consultar: vi.fn(), ficha: vi.fn(), dashboard: vi.fn(), membresia: vi.fn(), configuracion: vi.fn(), contar: vi.fn(), descargar: vi.fn(), guardar: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => m.search }),
  useNavigate: () => m.navigate,
  Link: ({ to, search, children, ...props }: { to: string; search?: Record<string, string>; children: ReactNode }) => <a {...props} href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}>{children}</a>,
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => <span>Cargando</span> }));
vi.mock("@/components/negocio/ajuste-manual", () => ({ AjusteManual: () => null }));
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => ({ data: undefined }), PendientesAsistente: () => null }));
vi.mock("@/components/negocio/comun", () => ({ SeccionNegocio: ({ children }: { children: ReactNode }) => <>{children}</>, ConConfig: ({ children }: { children: (c: object) => ReactNode }) => children({ negocio: { nombre_comercial: "Barbería Demo" } }) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@/lib/api/dueno", () => ({ consultarClientes: m.consultar, fichaCliente: m.ficha, dashboard: m.dashboard, membresia: m.membresia }));
vi.mock("@/lib/api/caja", () => ({ configuracion: m.configuracion }));
vi.mock("@/lib/api/marketing", () => ({ contarReporte: m.contar, descargarReporte: m.descargar }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), guardarArchivo: m.guardar }));

const cliente: ClienteLista = { negocio_cliente_id: "archivado", nombre: "Teclado Pruebas", apellido_paterno: null, apellido_materno: null, telefono: "+525510000070", cuenta_activada: true, cliente_desde: "2026-01-01T00:00:00Z", ultima_compra_en: null, saldo_centavos: 5000, premios_por_canjear: null, archivado: true, archivado_en: "2026-10-22T07:00:00Z" };
const ficha: FichaCliente = { cliente: { persona_id: "pruebas", nombre: cliente.nombre, apellido_paterno: null, telefono: cliente.telefono, cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true, correo: { estado: "confirmado", enmascarado: null } }, monedero: { saldo_centavos: 5000, fecha_vencimiento: null, acumula: true }, resumen: { cliente_desde: cliente.cliente_desde, ultima_compra_en: null, acepta_promociones: true, reclamaciones_pendientes: 0, archivado: true, archivado_en: cliente.archivado_en, ultima_actividad_en: null } };
function datos(archivados_total: number): Dashboard {
  return { periodo: { desde: "2026-10-22", hasta: "2026-10-22", jornadas: 1, zona_horaria: "America/Mexico_City", en_curso: true }, monedero: null, tarjetas: null, clientes: { atendidos: 0, altas: 0, bajas: 0, activos_total: 1, archivados_total }, cajeros: [], serie: [], reclamaciones: { pendientes: 0, mas_antigua_en: null }, validaciones_alta: { pendientes: 0 }, nota_ventas: "" };
}
function clientes() { const Component = ClientesRoute.options.component; if (Component) render(<Component />); }
function reportes() { const Component = ReportesRoute.options.component; if (Component) render(<Component />); }
function panel() { const Component = PanelRoute.options.component; if (Component) render(<Component />); }

beforeEach(() => {
  vi.clearAllMocks(); m.search = {};
  m.consultar.mockResolvedValue({ total: 1, clientes: [cliente], siguiente: null });
  m.ficha.mockResolvedValue(ficha); m.dashboard.mockResolvedValue(datos(2));
  m.membresia.mockResolvedValue(null); m.configuracion.mockResolvedValue({ negocio: { pin_pos_configurado: true } });
  m.contar.mockResolvedValue({ conteo: 1, tope: 20000, excede_limite: false }); m.descargar.mockResolvedValue({});
  vi.useRealTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("P16 Clientes", () => {
  it("Activos por omisión y Todos navega con incluir", async () => {
    clientes(); await waitFor(() => expect(m.consultar).toHaveBeenCalled());
    expect(m.consultar.mock.calls[0]?.[0]).not.toHaveProperty("archivados");
    expect(screen.getByRole("radio", { name: "Activos" })).toHaveAttribute("data-state", "on");
    fireEvent.click(screen.getByRole("radio", { name: "Todos" }));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/clientes", search: { archivados: "incluir" }, replace: true });
  });
  it("la búsqueda sin resultados permite incluir archivados", async () => {
    m.consultar.mockResolvedValue({ total: 0, clientes: [], siguiente: null }); clientes();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "0070" } });
    await screen.findByRole("button", { name: "Buscar también en archivados" });
    fireEvent.click(screen.getByRole("button", { name: "Buscar también en archivados" }));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/clientes", search: { archivados: "incluir" }, replace: true });
  });
  it("URL solo marca Archivados y conserva el filtro al paginar", async () => {
    m.search = { archivados: "solo" };
    m.consultar.mockResolvedValueOnce({ total: 2, clientes: [cliente], siguiente: { antes_de: "2026-10-22", antes_id: "archivado" } });
    m.consultar.mockResolvedValue({ total: 2, clientes: [{ ...cliente, negocio_cliente_id: "otro" }], siguiente: null });
    clientes(); await screen.findByRole("button", { name: "Cargar más" });
    expect(m.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ archivados: "solo" }));
    expect(screen.getByRole("radio", { name: "Archivados" })).toHaveAttribute("data-state", "on");
    expect(screen.queryByRole("link", { name: "Ver todos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await waitFor(() => expect(m.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ archivados: "solo", antes_id: "archivado" })));
  });
  it("URL incluir marca Todos y Activos vuelve sin parámetros", async () => {
    m.search = { archivados: "incluir" };
    clientes(); await waitFor(() => expect(m.consultar).toHaveBeenCalledWith(expect.objectContaining({ archivados: "incluir" })));
    expect(screen.getByRole("radio", { name: "Todos" })).toHaveAttribute("data-state", "on");
    fireEvent.click(screen.getByRole("radio", { name: "Activos" }));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/clientes", search: {}, replace: true });
  });
  for (const archivado of [true, false]) it(`la ficha respeta archivado=${archivado}`, async () => {
    m.ficha.mockResolvedValue({ ...ficha, resumen: { ...ficha.resumen, archivado } }); clientes();
    fireEvent.click(await screen.findByRole("button", { name: /Teclado Pruebas/ }));
    await waitFor(() => expect(m.ficha).toHaveBeenCalledWith("archivado"));
    await waitFor(() => expect(screen.queryByText(/Cliente desde/)).toBeInTheDocument());
    expect(Boolean(screen.queryByText(/Archivado desde/))).toBe(archivado);
  });
  it("formatea el día en la zona del negocio, no en UTC", () => {
    expect(diaDeInstante("2026-10-23T01:00:00Z")).toBe(diaDeInstante("2026-10-22T12:00:00Z"));
    expect(diaDeInstante(null)).toBe("");
  });
});

describe("P16 Reportes", () => {
  it("cumpleañeros incluye el mismo filtro al contar y descargar; cambiarlo descarta el conteo", async () => {
    reportes(); const seccion = screen.getByRole("heading", { name: "Cumpleañeros" }).closest("section"); if (!seccion) throw new Error("Falta reporte");
    const r = within(seccion); fireEvent.click(r.getByRole("checkbox", { name: "Incluir archivados" })); fireEvent.click(r.getByRole("button", { name: "Contar" }));
    await waitFor(() => expect(m.contar).toHaveBeenCalledWith("cumpleaneros", expect.objectContaining({ incluir_archivados: true })));
    fireEvent.click(await r.findByRole("button", { name: "Descargar Excel" }));
    await waitFor(() => expect(m.descargar).toHaveBeenCalledWith("cumpleaneros", expect.objectContaining({ incluir_archivados: true })));
    fireEvent.click(r.getByRole("checkbox")); expect(r.queryByRole("button", { name: "Descargar Excel" })).toBeNull();
    fireEvent.click(r.getByRole("button", { name: "Contar" }));
    await waitFor(() => expect(m.contar).toHaveBeenLastCalledWith("cumpleaneros", expect.objectContaining({ incluir_archivados: false })));
  });
  it("inactivos usa hace 1 año a 30 días y nunca envía incluir_archivados", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T18:00:00Z")); reportes();
    const seccion = screen.getByRole("heading", { name: "Inactivos" }).closest("section"); if (!seccion) throw new Error("Falta reporte"); const r = within(seccion);
    expect(r.getByLabelText("Desde")).toHaveValue("2025-10-22"); expect(r.getByLabelText("Hasta")).toHaveValue("2026-09-22");
    fireEvent.click(r.getByRole("button", { name: "Contar" }));
    await waitFor(() => expect(m.contar).toHaveBeenCalledWith("inactivos", { desde: "2025-10-22", hasta: "2026-09-22" }));
    fireEvent.click(await r.findByRole("button", { name: "Descargar Excel" }));
    await waitFor(() => expect(m.descargar).toHaveBeenCalledWith("inactivos", { desde: "2025-10-22", hasta: "2026-09-22" }));
  });
});

describe("P16 Panel", () => {
  for (const total of [2, 0]) it(`archivados_total=${total}`, async () => {
    m.dashboard.mockResolvedValue(datos(total)); panel(); await screen.findByRole("heading", { name: "Panel" });
    const link = screen.queryByRole("link", { name: /Clientes archivados/ });
    if (total) expect(link).toHaveAttribute("href", "/clientes?archivados=solo"); else expect(link).toBeNull();
  });
});