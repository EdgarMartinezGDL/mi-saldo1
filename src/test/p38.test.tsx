import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnlaceRegistro } from "@/components/qr-registro";
import { CartelRegistro } from "@/routes/negocio.cartel";
import { Route as PanelRoute } from "@/routes/panel";
import { Route as HistorialRoute } from "@/routes/historial";
import { FilaMovimiento } from "@/components/negocio/operacion-ui";
import estilos from "@/styles.css?raw";
import clientes from "@/routes/clientes.tsx?raw";

const m = vi.hoisted(() => ({ rol: "dueno", conectado: true, codigo: vi.fn(), logo: null as string | null, movimientos: vi.fn() }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ conectado: m.conectado, sesion: { contexto: { rol: m.rol, nombre_comercial: "Café 100% natural" } } }) }));
vi.mock("@/lib/api/registro", () => ({ miCodigoRegistro: m.codigo }));
vi.mock("@/components/negocio/comun", () => ({ useConfigNegocio: () => ({ data: { negocio: { logo_url: m.logo } } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => vi.fn(), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => ({}), PendientesAsistente: () => null }));
vi.mock("@/lib/api/caja", () => ({ configuracion: async () => ({ negocio: { pin_pos_configurado: true } }) }));
vi.mock("@/lib/api/dueno", () => ({ dashboard: async () => ({ periodo: { hasta: "2026-11-18" }, clientes: { atendidos: 2, archivados_total: 0 }, reclamaciones: { pendientes: 0 }, validaciones_alta: { pendientes: 0 }, cajeros: [] }), membresia: async () => ({}) }));
vi.mock("@/lib/api/cliente", () => ({ movimientos: m.movimientos }));
vi.mock("@/lib/use-recarga-visible", () => ({ useRecargaVisible: () => {} }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg aria-label="Código QR de registro" data-value={value} /> }));

const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks(); m.rol = "dueno"; m.logo = null; m.conectado = true;
  m.codigo.mockRejectedValue(new Error("404")); localStorage.clear();
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });

describe("P38 enlace compartido y cartel", () => {
  it.each([false, true])("registro disponible=%s", async (registro) => {
    if (registro) m.codigo.mockResolvedValue({ codigo: "ABC123" });
    const { result } = renderHook(useEnlaceRegistro, { wrapper });
    await waitFor(() => expect(m.codigo).toHaveBeenCalled());
    await act(async () => {});
    await waitFor(() => expect(result.current).toEqual({ nombre: "Café 100% natural", enlace: `${location.origin}/${registro ? "registro#c=ABC123" : "bienvenida#n=Caf%C3%A9%20100%25%20natural"}`, conRegistro: registro }));
  });
  it("cliente no obtiene enlace ni consulta", () => {
    m.rol = "cliente"; const { result } = renderHook(useEnlaceRegistro, { wrapper });
    expect(result.current.enlace).toBeNull(); expect(m.codigo).not.toHaveBeenCalled();
  });
  it.each(["dueno", "empleado"])("acceso del panel para %s", async (rol) => {
    m.rol = rol;
    const Panel = (PanelRoute as unknown as { options: { component: ComponentType } }).options.component;
    render(<Panel />, { wrapper }); await screen.findByText("Cómo va tu negocio hoy.");
    if (rol === "dueno") expect(screen.getByRole("link", { name: "Imprimir cartel" })).toHaveAttribute("href", "/negocio/cartel");
    else expect(screen.queryByRole("link", { name: "Imprimir cartel" })).toBeNull();
  });
  it.each([false, true])("cartel comparte destino disponible=%s e imprime", async (registro) => {
    if (registro) m.codigo.mockResolvedValue({ codigo: "ABC123" });
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<CartelRegistro />, { wrapper }); await act(async () => {});
    const enlace = `${location.origin}/${registro ? "registro#c=ABC123" : "bienvenida#n=Caf%C3%A9%20100%25%20natural"}`;
    expect(screen.getByRole("heading", { name: "Café 100% natural" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", enlace));
    expect(screen.getByText(`Este cartel abre: ${enlace}`)).toBeInTheDocument();
    expect(screen.getByLabelText("Inicial de Café 100% natural")).toHaveTextContent("C");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" })); expect(imprimir).toHaveBeenCalledOnce();
  });
  it("imagen fallida usa inicial y http advierte", () => {
    m.logo = "https://x.test/logo.png"; render(<CartelRegistro />, { wrapper });
    fireEvent.error(screen.getByRole("img", { name: "Café 100% natural" }));
    expect(screen.getByLabelText("Inicial de Café 100% natural")).toHaveTextContent("C");
    expect(screen.getByText(/Ojo: estás en una dirección de prueba/)).toBeInTheDocument();
  });
});

describe("P38 instalación del dispositivo", () => {
  async function preparar() {
    // Módulo fresco para simular una nueva carga del dispositivo, no una sesión de usuario.
    vi.resetModules();
    const instalacion = await import("@/lib/instalacion");
    const { InvitarInstalar } = await import("@/components/invitar-instalar");
    instalacion.escucharInstalacion();
    return { instalacion, InvitarInstalar };
  }
  function emitir(outcome: "accepted" | "dismissed") {
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome }) });
    act(() => { window.dispatchEvent(event); });
    return { prompt, event };
  }
  it("sin evento no aparece", async () => {
    m.rol = "cliente"; const { InvitarInstalar } = await preparar(); render(<InvitarInstalar />);
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });
  it.each(["accepted", "dismissed"] as const)("evento anterior al montaje, elección %s", async (outcome) => {
    m.rol = "cliente"; const { InvitarInstalar } = await preparar(); const { prompt, event } = emitir(outcome);
    expect(event.defaultPrevented).toBe(true); render(<InvitarInstalar />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar" })); await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(localStorage.getItem("misaldo-invitar-instalar")).toBe(outcome === "accepted" ? "cerrado" : null);
    expect(screen.queryByRole("heading", { name: /Instala Mi Saldo Vip/ }) !== null).toBe(outcome === "dismissed");
  });
  it("iPhone muestra pasos sin botón", async () => {
    m.rol = "cliente"; vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
    const { InvitarInstalar } = await preparar(); render(<InvitarInstalar />);
    expect(screen.getByText("Compartir")).toBeInTheDocument(); expect(screen.getByText("Agregar a inicio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });
  it.each(["dueno", "sin_conexion", "standalone"])("oculto en %s", async (estado) => {
    m.rol = estado === "dueno" ? "dueno" : "cliente"; m.conectado = estado !== "sin_conexion";
    if (estado === "standalone") vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { InvitarInstalar } = await preparar(); emitir("dismissed"); render(<InvitarInstalar />);
    expect(screen.queryByRole("heading", { name: /Instala Mi Saldo Vip/ })).toBeNull();
  });
  it.each([false, true])("cierre y remontaje con almacenamiento fallido=%s", async (falla) => {
    m.rol = "cliente";
    if (falla) { vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); }); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); }); }
    const { InvitarInstalar } = await preparar(); emitir("dismissed"); const vista = render(<InvitarInstalar />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso de instalación" }));
    expect(screen.queryByRole("heading", { name: /Instala Mi Saldo Vip/ })).toBeNull();
    if (!falla) expect(localStorage.getItem("misaldo-invitar-instalar")).toBe("cerrado");
    vista.unmount(); render(<InvitarInstalar />); expect(screen.queryByRole("heading", { name: /Instala Mi Saldo Vip/ })).toBeNull();
  });
  it("oyentes únicos y appinstalled guarda la marca", async () => {
    const { instalacion } = await preparar(); const add = vi.spyOn(window, "addEventListener");
    instalacion.escucharInstalacion(); instalacion.escucharInstalacion(); expect(add).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("appinstalled")); expect(localStorage.getItem("misaldo-invitar-instalar")).toBe("cerrado");
  });
});

describe("P38 vencimiento", () => {
  const base = { movimiento_id: "uno", fecha: "2026-11-18T05:00:00Z", jornada: "2026-11-18", modulo: "tarjetas_sellos" as const, tipo: "vencimiento" as const };
  it.each([[-2, "Venció tu tarjeta: 2 sellos"], [0, "Venció tu tarjeta"]] as const)("cliente cantidad %s", async (cantidad, esperado) => {
    m.rol = "cliente"; m.movimientos.mockResolvedValue({ movimientos: [{ ...base, cantidad }], siguiente: null });
    const Historial = (HistorialRoute as unknown as { options: { component: ComponentType } }).options.component;
    render(<Historial />); expect(await screen.findByText(esperado)).toBeInTheDocument();
  });
  it.each([[0, "Café", "Venció una tarjeta en Café"], [0, undefined, "Venció una tarjeta"], [-2, undefined, "Venció 2 sellos"]] as const)("dueño cantidad %s tarjeta %s", (cantidad, tarjeta, esperado) => {
    render(<ul><FilaMovimiento m={{ ...base, cantidad, ...(tarjeta ? { tarjeta } : {}) }} /></ul>);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });
});

describe("P38 etiqueta ámbar", () => {
  it("conserva la píldora y define ambos tonos", () => {
    expect(clientes).toContain('className="pill-badge shrink-0 py-0.5 text-xs leading-4 text-warning-etiqueta">Sin activar');
    expect(estilos).toContain("--color-warning-etiqueta: var(--warning-etiqueta)");
    expect(estilos).toMatch(/:root\s*\{[^}]*--warning-etiqueta: #92400e/s);
    expect(estilos).toMatch(/\.dark\s*\{[^}]*--warning-etiqueta: #fcd34d/s);
  });
});