import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as PinRoute } from "@/routes/negocio.pin-pos";
import { Route as ClienteRoute } from "@/routes/index";
import { Route as ReclamacionesRoute } from "@/routes/reclamaciones";
import { Route as CajaRoute } from "@/routes/caja";
import { AppShell } from "@/components/app-shell";
import { MiSaldoProvider } from "@/components/misaldo-provider";
import { CajaProvider, soloMonto, type CajaCtx } from "@/components/caja/caja-contexto";
import { PasoAcumular } from "@/components/caja/paso-operacion";
import { PasoFicha } from "@/components/caja/paso-ficha";
import { PasoComprobante } from "@/components/caja/paso-comprobante";
import { ApiError } from "@/lib/api/client";
import type { ClienteCaja, ConfiguracionNegocio } from "@/lib/api/caja";
import { useRecargaVisible } from "@/lib/use-recarga-visible";

const m = vi.hoisted(() => ({ pin: vi.fn(), resumen: vi.fn(), config: vi.fn(), sellos: vi.fn(), error: vi.fn(), success: vi.fn(), pendientes: 0, rol: "cliente", id: "a" }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useRouterState: () => "/", useNavigate: () => vi.fn(), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", conectado: true, sesion: { contexto: { rol: m.rol, negocio_id: m.id, nombre_comercial: `Negocio ${m.id}` } } }) }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ varios: false, dialogo: null }) }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({ dialogo: null, pedirConfirmacion: vi.fn() }) }));
vi.mock("@/components/aviso-pendiente", () => ({ AvisoPendiente: () => null }));
vi.mock("@/lib/use-mis-validaciones", () => ({ useMisValidaciones: () => ({ data: { validaciones: Array.from({ length: m.pendientes }, () => ({ estado: "pendiente" })) } }) }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => <p>Cargando</p> }));
vi.mock("@/components/negocio/comun", () => ({ SeccionNegocio: ({ children }: { children: ReactNode }) => <>{children}</>, ConConfig: ({ children }: { children: (c: object) => ReactNode }) => children({ negocio: { pin_pos_configurado: true } }), useConfigNegocio: () => ({ actualizar: vi.fn() }), mostrarError: m.error }));
vi.mock("@/components/negocio/asistente", () => ({ useInvalidarAsistente: () => vi.fn(), validarBusquedaAsistente: () => ({}) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@/lib/api/dueno", () => ({ cambiarPinPos: m.pin }));
vi.mock("@/lib/api/cliente", () => ({ resumen: m.resumen, fichaNegocio: async () => null, perfil: async () => ({ nombre: "Ana" }), referidos: async () => ({ programa: null, recomendados: [] }), reclamaciones: async () => ({ reclamaciones: [] }) }));
vi.mock("@/lib/api/caja", async (original) => ({ ...await original<typeof import("@/lib/api/caja")>(), configuracion: m.config, acumularSellos: m.sellos, estadoPos: async () => ({ desbloqueado: true, pin_pos_configurado: true, en_horario: true, horario_aplica: false, vence_en: null }) }));
vi.mock("sonner", () => ({ toast: { error: m.error, success: m.success } }));

const clientes: QueryClient[] = [];
function envolver(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clientes.push(client);
  return render(<QueryClientProvider client={client}><MiSaldoProvider>{children}</MiSaldoProvider></QueryClientProvider>);
}
function pagina(route: { options: { component?: unknown } }) {
  const C = route.options.component as (() => ReactNode) | undefined;
  if (!C) throw new Error("Falta pantalla");
  return envolver(<C />);
}
const ficha: ClienteCaja = { cliente: { persona_id: "ana", nombre: "Ana", apellido_paterno: null, cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true, correo: { estado: "confirmado", enmascarado: "a***" } }, tarjetas: [{ tarjeta_digital_id: "t", nombre: "Café", tipo_sello: "por_transaccion", premio_texto: "Café gratis", premio_por_canjear: null, activa: true, acumula: true, sellos_actuales: 0, sellos_requeridos: 10, remanente_centavos: 0, completas_por_canjear: 0, fecha_vencimiento: null }] };
const cfg: ConfiguracionNegocio = { negocio: { negocio_id: "a", nombre_comercial: "Negocio a", logo_url: "/marca/logo-circular.png", moneda: "MXN", pin_pos_configurado: true, membresia_estado: "activa", giro: null, tema_id: 1, zona_horaria: "America/Mexico_City", limite_tarjetas_activas: 3, direccion: null, telefono_contacto: null, telefono_es_whatsapp: false }, modulos: ["tarjetas_sellos"], modulos_en_retiro: [], monedero: null, tarjetas: [{ tarjeta_digital_id: "t", nombre: "Café", tipo_sello: "por_transaccion", sellos_requeridos: 10, valor_por_sello_centavos: null, premio_texto: "Café gratis", vigencia_dias: 30, activa: true, creado_en: "2026-01-01" }] };
function contexto(config = cfg): CajaCtx { return { config, moneda: "MXN", zona: "America/Mexico_City", rol: "dueno", ejecutar: (fn) => fn(), recargarConfig: vi.fn() }; }
function acumular(c = ficha, config = cfg, hecho = vi.fn()) { return envolver(<CajaProvider valor={contexto(config)}><PasoAcumular telefono="3312345678" ficha={c} onVolver={vi.fn()} onHecho={hecho} /></CajaProvider>); }
beforeEach(() => {
  vi.clearAllMocks(); m.rol = "cliente"; m.id = "a"; m.pendientes = 0;
  m.pin.mockResolvedValue({ primera_vez: false }); m.config.mockResolvedValue(cfg);
  m.resumen.mockImplementation(async () => ({ negocio: { negocio_id: m.id, nombre_comercial: `Negocio ${m.id}`, logo_url: `/logo-${m.id}.png`, moneda: "MXN" }, monedero: null, tarjetas: null }));
  m.sellos.mockResolvedValue({ sellos_agregados: 1, tarjetas_completadas: [], tarjeta: { sellos_actuales: 1, sellos_requeridos: 10, fecha_vencimiento: "2027-02-14" } });
});
afterEach(() => { cleanup(); clientes.splice(0).forEach((c) => c.clear()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("P29 PIN POS", () => {
  function llenar(confirmacion: string) {
    pagina(PinRoute);
    fireEvent.change(screen.getByLabelText("Tu PIN de acceso (con el que entras a la app)"), { target: { value: "4821" } });
    fireEvent.change(screen.getByLabelText("Nuevo PIN POS para abrir las cajas"), { target: { value: "582739" } });
    fireEvent.change(screen.getByLabelText("Confirma el nuevo PIN POS"), { target: { value: confirmacion } });
  }
  it("no gasta intentos con confirmación distinta", () => {
    llenar("582738"); const boton = screen.getByRole("button", { name: "Cambiar PIN POS" });
    expect(boton).toBeDisabled(); expect(screen.getByRole("alert")).toHaveTextContent("Los dos PIN POS no coinciden"); fireEvent.click(boton); expect(m.pin).not.toHaveBeenCalled();
  });
  it("identifica el PIN de acceso incorrecto y los dos intentos restantes", async () => {
    m.pin.mockRejectedValue(new ApiError(400, { codigo: "pin_incorrecto", intentos_restantes: 2 })); llenar("582739");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar PIN POS" }));
    expect(await screen.findByText("Tu PIN de acceso es incorrecto")).toBeInTheDocument(); expect(screen.getByText("Te quedan 2 intentos")).toBeInTheDocument();
  });
  it("vacía los tres campos tras guardar", async () => {
    llenar("582739"); fireEvent.click(screen.getByRole("button", { name: "Cambiar PIN POS" }));
    await waitFor(() => expect(screen.getByLabelText("Confirma el nuevo PIN POS")).toHaveValue(""));
    expect(screen.getByLabelText("Nuevo PIN POS para abrir las cajas")).toHaveValue(""); expect(screen.getByLabelText("Tu PIN de acceso (con el que entras a la app)")).toHaveValue("");
  });
});
describe("P29 vencimiento", () => {
  it("bloquea botón y Enter en primera compra hasta explicar la vigencia", () => {
    acumular(); expect(screen.getByRole("button", { name: "Acumular" })).toBeDisabled(); fireEvent.keyDown(window, { key: "Enter" }); expect(screen.queryByRole("alertdialog")).toBeNull(); expect(m.sellos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox")); expect(screen.getByRole("button", { name: "Acumular" })).toBeEnabled();
  });
  it("con tres sellos solo muestra la fecha renovada en la zona del negocio", () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-16T02:20:00Z"));
    acumular({ ...ficha, tarjetas: ficha.tarjetas?.map((t) => ({ ...t, sellos_actuales: 3 })) });
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.getByText(/vence el 15\/12\/2026/)).toBeInTheDocument();
  });
  it("sin vigencia no muestra leyenda ni casilla", () => {
    acumular(ficha, { ...cfg, tarjetas: cfg.tarjetas?.map((t) => ({ ...t, vigencia_dias: null })) });
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByText(/Cada compra renueva/)).toBeNull();
  });
  it.each(["2027-02-14", null])("comprobante muestra vencimiento solo cuando existe: %s", async (fecha) => {
    const hecho = vi.fn(); m.sellos.mockResolvedValue({ sellos_agregados: 1, tarjetas_completadas: [], tarjeta: { sellos_actuales: 4, sellos_requeridos: 10, fecha_vencimiento: fecha } });
    acumular({ ...ficha, tarjetas: ficha.tarjetas?.map((t) => ({ ...t, sellos_actuales: 3 })) }, cfg, hecho);
    fireEvent.click(screen.getByRole("button", { name: "Acumular" })); fireEvent.click(screen.getByRole("button", { name: "Sí, acumular" }));
    await waitFor(() => expect(hecho).toHaveBeenCalled()); const comprobante = hecho.mock.calls[0]?.[0]; cleanup();
    render(<PasoComprobante comprobante={comprobante} nombre={null} onNuevo={vi.fn()} onSeguir={vi.fn()} />);
    if (fecha) expect(screen.getByText("Tarjeta vence el 14/02/2027 (se renueva con cada compra)")).toBeInTheDocument();
    else expect(screen.queryByText(/Tarjeta vence el/)).toBeNull();
  });
});
describe("P29 barra y logo", () => {
  it("sin pendientes muestra marca y no enlace", () => { envolver(<AppShell>Contenido</AppShell>); expect(screen.queryByRole("link", { name: /Solicitudes por confirmar/ })).toBeNull(); expect(screen.getByText("Mi Saldo Vip · By MicroFix Cloud")).toBeInTheDocument(); });
  it("con un pendiente muestra enlace y contador", () => { m.pendientes = 1; envolver(<AppShell>Contenido</AppShell>); expect(screen.getByRole("link", { name: "Solicitudes por confirmar: 1" })).toHaveAttribute("href", "/validaciones"); });
  it("empleado ve logo de configuración", async () => { m.rol = "empleado"; pagina(CajaRoute); expect(await screen.findByRole("img", { name: "Logo de Negocio a" })).toHaveAttribute("src", cfg.negocio.logo_url); });
  it("cliente ve logo nuevo al cambiar contexto y recargar otra ruta", async () => {
    const view = pagina(ClienteRoute); expect(await screen.findByRole("img", { name: "Logo de Negocio a" })).toHaveAttribute("src", "/logo-a.png");
    m.id = "b"; view.rerender(<QueryClientProvider client={clientes[0] ?? new QueryClient()}><MiSaldoProvider><AppShell>Otra página</AppShell></MiSaldoProvider></QueryClientProvider>);
    expect(await screen.findByRole("img", { name: "Logo de Negocio b" })).toHaveAttribute("src", "/logo-b.png");
    cleanup(); envolver(<AppShell>Recarga</AppShell>); expect(await screen.findByRole("img", { name: "Logo de Negocio b" })).toHaveAttribute("src", "/logo-b.png");
  });
});
describe("P29 reclamaciones y montos", () => {
  it("acción de reclamación conserva R", () => { const accion = vi.fn(); envolver(<CajaProvider valor={contexto()}><PasoFicha ficha={ficha} onAccion={accion} onVolver={vi.fn()} onRefrescar={async () => {}} /></CajaProvider>); expect(screen.getByRole("button", { name: /Reclamación: compra no registrada/ })).toBeInTheDocument(); fireEvent.keyDown(window, { key: "r" }); expect(accion).toHaveBeenCalledWith("reclamar"); });
  it("cliente vacío muestra Acude con el cajero", async () => { pagina(ReclamacionesRoute); expect(await screen.findByText(/Acude con el cajero del negocio con tu ticket/)).toBeInTheDocument(); });
  it("limita montos a dos decimales", () => { expect(soloMonto("12.345")).toBe("12.34"); expect(soloMonto("12.3.45")).toBe("12.34"); });
  it("recarga cada 20 segundos solo visible y con red, y al volver", () => {
    vi.useFakeTimers(); const recargar = vi.fn(); let visible = true; let online = true;
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden"); vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    function Prueba() { useRecargaVisible(recargar); return null; } render(<Prueba />);
    act(() => vi.advanceTimersByTime(20_000)); expect(recargar).toHaveBeenCalledTimes(1);
    visible = false; fireEvent(document, new Event("visibilitychange")); act(() => vi.advanceTimersByTime(40_000)); expect(recargar).toHaveBeenCalledTimes(1);
    visible = true; fireEvent(document, new Event("visibilitychange")); expect(recargar).toHaveBeenCalledTimes(2);
    online = false; fireEvent(window, new Event("offline")); act(() => vi.advanceTimersByTime(20_000)); expect(recargar).toHaveBeenCalledTimes(2);
  });
});