import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { textoIntentos } from "@/lib/plural";
import { tieneReferidos, type MisReferidos } from "@/lib/api/cliente";
import { ApiError } from "@/lib/api/client";
import { Route as LoginRoute } from "@/routes/login";
import { Route as PinRoute } from "@/routes/negocio.pin-pos";
import { Route as CuentaRoute } from "@/routes/ajustes";

const m = vi.hoisted(() => ({ login: vi.fn(), pin: vi.fn(), referidos: vi.fn(), rol: "cliente", conectado: true, sesion: true }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/lib/api/auth", () => ({ login: m.login }));
vi.mock("@/lib/api/dueno", () => ({ cambiarPinPos: m.pin }));
vi.mock("@/lib/api/cliente", async (original) => ({ ...await original<typeof import("@/lib/api/cliente")>(), referidos: m.referidos }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", conectado: m.conectado, sesion: m.sesion ? { contexto: { rol: m.rol } } : null }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/continuar-sesion", () => ({ ContinuarSesion: () => null, destinoSeguro: () => null }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({ dialogo: null, pedirConfirmacion: vi.fn() }) }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ varios: false, dialogo: null }) }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ theme: "claro", setTheme: vi.fn() }) }));
vi.mock("@/components/cuenta/mis-codigos", () => ({ TarjetaMisCodigos: () => null }));
vi.mock("@/components/cuenta/secciones", () => ({ Encabezado: () => null, MisDatos: () => null, NotificacionesDispositivo: () => null, Promociones: () => null, Seguridad: () => null, Tarjeta: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/negocio/asistente", () => ({ useInvalidarAsistente: () => vi.fn(), validarBusquedaAsistente: () => ({}) }));
vi.mock("@/components/negocio/comun", () => ({ SeccionNegocio: ({ children }: { children: ReactNode }) => <>{children}</>, ConConfig: ({ children }: { children: (c: object) => ReactNode }) => children({ negocio: { pin_pos_configurado: true } }), useConfigNegocio: () => ({ actualizar: vi.fn() }), mostrarError: vi.fn() }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));

const vacio: MisReferidos = { programa: null, recomendados: [], me_recomendo: null, totales: {} };
const programa: MisReferidos = { ...vacio, programa: { monto_minimo_centavos: 10000, vigencia_dias: 30, premio: { modulo: "monedero", monto_centavos: 1000, sellos: null, tarjeta_nombre: null } } };
const recomendado: MisReferidos = { ...vacio, recomendados: [{ referido_id: "uno", nombre: "Ana", estado: "pendiente", fecha_registro: "2026-11-17", monto_minimo_centavos: 10000, ultimo_dia: null, dias_restantes: null, premio: { modulo: "monedero", monto_centavos: 1000, sellos: null, tarjeta_nombre: null }, fecha_cumplimiento: null, motivo_sin_premio: null }] };
const clients: QueryClient[] = [];
function pagina(route: unknown) {
  const C = (route as { options: { component: ComponentType } }).options.component;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><C /></QueryClientProvider>);
  return client;
}
beforeEach(() => { vi.clearAllMocks(); m.rol = "cliente"; m.conectado = true; m.sesion = true; m.referidos.mockResolvedValue(vacio); });
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe("P31 intentos", () => {
  it.each([[1, "Te queda 1 intento"], [0, "Te quedan 0 intentos"], [4, "Te quedan 4 intentos"]] as const)("%s intentos", (n, texto) => { expect(textoIntentos(n)).toBe(texto); });
  it("Login muestra el singular tras PIN incorrecto", async () => {
    m.login.mockRejectedValue(new ApiError(401, { codigo: "pin_incorrecto", intentos_restantes: 1 }));
    pagina(LoginRoute);
    fireEvent.change(screen.getByLabelText("Teléfono (10 dígitos)"), { target: { value: "3312345678" } });
    fireEvent.change(screen.getByLabelText("PIN de acceso (6 dígitos)"), { target: { value: "4821" } });
    fireEvent.click(screen.getByRole("button", { name: /^Entrar$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Te queda 1 intento.");
    expect(screen.queryByText(/1 intentos/)).toBeNull();
  });
  it("PIN POS del dueño muestra el singular", async () => {
    m.rol = "dueno"; m.pin.mockRejectedValue(new ApiError(400, { codigo: "pin_incorrecto", intentos_restantes: 1 }));
    pagina(PinRoute);
    fireEvent.change(screen.getByLabelText("PIN de acceso (6 dígitos)"), { target: { value: "4821" } });
    fireEvent.change(screen.getByLabelText("Nuevo PIN POS para abrir las cajas"), { target: { value: "582739" } });
    fireEvent.change(screen.getByLabelText("Confirma el nuevo PIN POS"), { target: { value: "582739" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar PIN POS" }));
    expect(await screen.findByText("Te queda 1 intento")).toBeInTheDocument();
  });
});
describe("P31 recomendaciones", () => {
  it.each([[undefined, false], [vacio, false], [programa, true], [recomendado, true]] as const)("regla compartida %#", (datos, esperado) => { expect(tieneReferidos(datos)).toBe(esperado); });
  it.each([[vacio, false], [programa, true], [recomendado, true]] as const)("Cuenta aplica la regla %#", async (datos, visible) => {
    m.referidos.mockResolvedValue(datos); const client = pagina(CuentaRoute);
    await waitFor(() => expect(client.getQueryState(["cliente-referidos"])?.status).toBe("success"));
    if (visible) expect(await screen.findByRole("link", { name: "Recomienda y gana" })).toBeInTheDocument();
    else expect(screen.queryByRole("link", { name: "Recomienda y gana" })).toBeNull();
    expect(screen.getByRole("link", { name: "Mis reclamaciones" })).toBeInTheDocument();
  });
  it("no muestra el enlace mientras carga", () => {
    m.referidos.mockReturnValue(new Promise(() => {})); pagina(CuentaRoute);
    expect(screen.queryByRole("link", { name: "Recomienda y gana" })).toBeNull();
  });
  it("no muestra datos anteriores cuando falla la consulta", async () => {
    m.referidos.mockResolvedValue(programa); const client = pagina(CuentaRoute);
    expect(await screen.findByRole("link", { name: "Recomienda y gana" })).toBeInTheDocument();
    m.referidos.mockRejectedValue(new Error("Sin conexión"));
    await client.refetchQueries({ queryKey: ["cliente-referidos"] });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Recomienda y gana" })).toBeNull());
  });
  it.each(["sin sesión", "otro rol", "sin conexión"])("no consulta %s", (caso) => {
    if (caso === "sin sesión") m.sesion = false;
    if (caso === "otro rol") m.rol = "dueno";
    if (caso === "sin conexión") m.conectado = false;
    pagina(CuentaRoute); expect(m.referidos).not.toHaveBeenCalled();
  });
});