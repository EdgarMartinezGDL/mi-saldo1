import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { Registro, nacimientoValido } from "@/routes/registro";
import { RetomarRegistro, CLAVE_REGISTRO } from "@/components/retomar-registro";
import { BotonQrRegistro } from "@/components/qr-registro";
import { CartelRegistro } from "@/routes/negocio.cartel";
import { PasoBuscar } from "@/components/caja/paso-buscar";
import { enlaceRegistro, solicitarRegistro, unirmeNegocio, nuevoCodigoRegistro } from "@/lib/api/registro";
import { aprobarSolicitudRegistro, rechazarSolicitudRegistro } from "@/lib/api/caja";

const m = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), cambiar: vi.fn(), logout: vi.fn(), toast: vi.fn(), sesion: null as null | { contexto: { rol: string; nombre_comercial: string } }, hecha: vi.fn(), alta: vi.fn(), ejecutar: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/lib/api/auth", () => ({ cambiarContexto: m.cambiar, logout: m.logout }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: m.sesion ? "autenticado" : "anonimo", sesion: m.sesion }) }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => m.navigate, useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ status: "idle", location: { pathname: "/panel" } }), Link: ({ to, search, children, ...props }: { to: string; search?: Record<string, string>; children: ReactNode }) => <a href={to + (search ? `?${new URLSearchParams(search)}` : "")} {...props}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: m.toast, error: m.toast, info: m.toast } }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/negocio/comun", () => ({ useConfigNegocio: () => ({ data: { negocio: { logo_url: null } } }) }));
vi.mock("@/components/caja/caja-contexto", () => ({ useCaja: () => ({ ejecutar: m.ejecutar, moneda: "MXN" }), avisarError: m.toast }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg aria-label="Código QR de registro" data-value={value} /> }));
const clients: QueryClient[] = [];
function montar(children: ReactNode = <Registro />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
const pendiente = { solicitud_id: "sol-1", nombre: "Nora", apellido_paterno: "López", apellido_materno: null, nacimiento_dia: 29, nacimiento_mes: 2, correo_enmascarado: "n***@correo.mx", creada_en: "2026-11-19T20:00:00Z", expira_en: "2026-11-20T20:00:00Z" };
const alta = { pendiente: false, persona_id: "p", negocio_cliente_id: "nc", persona_nueva: true, cuenta_activada: false, enlace_activacion_enviado: true };
beforeEach(() => {
  vi.resetAllMocks(); m.sesion = null; sessionStorage.clear(); history.replaceState(null, "", "/registro#c=ABC123");
  m.cambiar.mockResolvedValue({}); m.ejecutar.mockImplementation((fn: () => unknown) => fn());
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/registro/negocio/ABC123") return { nombre_comercial: "Barbería Demo" };
    if (path === "/api/aviso-privacidad") return { version: "v1", resumen: "Aviso vigente", vigente: true };
    if (path === "/api/registro/solicitar") return { estado: "pendiente", expira_en: pendiente.expira_en };
    if (path === "/api/registro/unirme") return { estado: "unido", negocio_id: "b1", nombre_comercial: "Barbería Demo" };
    if (path === "/api/registro/mi-codigo") return { codigo: "ABC123" };
    if (path === "/api/registro/mi-codigo/nuevo") return { codigo: "NUEVO12" };
    if (path === "/api/clientes/busqueda") return { encontrado: false, solicitud_registro: pendiente };
    if (path.endsWith("/aprobacion")) return alta;
    if (path.endsWith("/sol-1")) return undefined;
    throw new Error(path);
  });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.useRealTimers(); });
async function llenar(aceptar = true) {
  await screen.findByRole("heading", { name: "Únete a Barbería Demo" });
  for (const [label, value] of [["Nombre", " Nora "], ["Apellido paterno", " López "], ["Tu celular (10 dígitos)", "55 1234 5678"], ["Día", "29"], ["Mes", "2"], ["Correo electrónico", "nora@correo.mx"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await screen.findByText("Aviso vigente");
  if (aceptar) fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
}
const enviar = () => fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" }));
const solicitudes = () => m.api.mock.calls.filter(([path]) => path === "/api/registro/solicitar");
const dueno = () => { m.sesion = { contexto: { rol: "dueno", nombre_comercial: "Barbería Demo" } }; };
async function caja() { dueno(); montar(<PasoBuscar inicial="5512345678" onAlta={m.alta} onEncontrado={vi.fn()} onAltaHecha={m.hecha} />); fireEvent.click(screen.getByRole("button", { name: /^Buscar/ })); await screen.findByText("Se registró desde el QR"); }

describe("P42 contratos permitidos", () => {
  it("enlace puro codificado", () => expect(enlaceRegistro("https://x.test", "A/B+C")).toBe("https://x.test/registro#c=A%2FB%2BC"));
  it("omite materno vacío", async () => { await solicitarRegistro({ codigo: "ABC123", telefono: "+525512345678", nombre: "Nora", apellido_paterno: "López", apellido_materno: " ", nacimiento_dia: 29, nacimiento_mes: 2, correo: "nora@correo.mx", acepta_aviso_privacidad: true, version_aviso: "v1" }); expect(solicitudes()[0]?.[1].body).not.toHaveProperty("apellido_materno"); });
  it("unión, renovación, aprobación sin cuerpo y rechazo", async () => {
    await unirmeNegocio("ABC123", "v1"); expect(m.api).toHaveBeenLastCalledWith("/api/registro/unirme", { method: "POST", body: { codigo: "ABC123", acepta_aviso_privacidad: true, version_aviso: "v1" } });
    await nuevoCodigoRegistro(); expect(m.api).toHaveBeenLastCalledWith("/api/registro/mi-codigo/nuevo", { method: "POST" });
    await aprobarSolicitudRegistro("a/b"); expect(m.api).toHaveBeenLastCalledWith("/api/clientes/solicitudes-registro/a%2Fb/aprobacion", { method: "POST" });
    m.api.mockResolvedValue(undefined); await rechazarSolicitudRegistro("a/b"); expect(m.api).toHaveBeenLastCalledWith("/api/clientes/solicitudes-registro/a%2Fb", { method: "DELETE" });
  });
  it.each([[31, 4, false], [30, 2, false], [29, 2, true], [0, 1, false], [1, 13, false]])("fecha %s/%s válida=%s", (d, m, ok) => expect(nacimientoValido(d as number, m as number)).toBe(ok));
});
describe("P42 registro público", () => {
  it.each(["aviso", "Día", "Mes", "Correo electrónico"])("sin %s no envía", async (campo) => { montar(); await llenar(campo !== "aviso"); if (campo !== "aviso") fireEvent.change(screen.getByLabelText(campo), { target: { value: "" } }); enviar(); expect(solicitudes()).toHaveLength(0); });
  it("cuerpo exacto, 29 febrero, pendiente y corregir conserva datos", async () => {
    montar(); await llenar(); enviar(); await screen.findByRole("heading", { name: "¡Listo, Nora!" });
    expect(m.api).toHaveBeenCalledWith("/api/registro/solicitar", { method: "POST", auth: false, body: { codigo: "ABC123", telefono: "+525512345678", nombre: "Nora", apellido_paterno: "López", nacimiento_dia: 29, nacimiento_mes: 2, correo: "nora@correo.mx", acepta_aviso_privacidad: true, version_aviso: "v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Corregir mis datos" })); expect(screen.getByLabelText("Nombre")).toHaveValue("Nora"); expect(screen.getByLabelText("Correo electrónico")).toHaveValue("nora@correo.mx"); await screen.findByText("Aviso vigente"); await act(async () => {}); enviar(); await waitFor(() => expect(solicitudes()).toHaveLength(2));
  });
  it("31 abril no envía", async () => { montar(); await llenar(); fireEvent.change(screen.getByLabelText("Día"), { target: { value: "31" } }); fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "4" } }); enviar(); expect(solicitudes()).toHaveLength(0); expect(screen.getByRole("alert")).toHaveTextContent("Esa fecha no existe"); });
  it("cuenta existente y destinos", async () => {
    montar(); await llenar(); m.api.mockResolvedValueOnce({ estado: "cuenta_existente" }); enviar(); await screen.findByRole("heading", { name: "Ya existe una cuenta con este número" });
    expect(screen.getByRole("link", { name: "Olvidé mi PIN" })).toHaveAttribute("href", "/recuperar?telefono=5512345678"); expect(screen.getByRole("link", { name: "Nunca activé mi cuenta" })).toHaveAttribute("href", "/activar"); fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" })); expect(sessionStorage.getItem(CLAVE_REGISTRO)).toBe("ABC123"); expect(m.navigate).toHaveBeenCalledWith({ to: "/login" });
  });
  it("entrada al login guarda código", async () => { montar(); await llenar(false); fireEvent.click(screen.getByRole("button", { name: "¿Ya tienes Mi Saldo Vip? Inicia sesión" })); expect(sessionStorage.getItem(CLAVE_REGISTRO)).toBe("ABC123"); });
  it("retoma una sola vez con sesión nueva", async () => {
    sessionStorage.setItem(CLAVE_REGISTRO, "ABC123"); const vista = montar(<RetomarRegistro />); expect(m.navigate).not.toHaveBeenCalled(); dueno(); vista.rerender(<QueryClientProvider client={clients[0] as QueryClient}><RetomarRegistro /></QueryClientProvider>);
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: "/registro", hash: "c=ABC123", replace: true })); expect(sessionStorage.getItem(CLAVE_REGISTRO)).toBeNull(); expect(m.navigate).toHaveBeenCalledTimes(1);
  });
  it.each(["", "a+b123", "ABCDE"])("no retoma clave inválida %s", async (codigo) => { dueno(); sessionStorage.setItem(CLAVE_REGISTRO, codigo); montar(<RetomarRegistro />); await waitFor(() => expect(sessionStorage.getItem(CLAVE_REGISTRO)).toBeNull()); expect(m.navigate).not.toHaveBeenCalled(); });
  it.each(["unido", "ya_es_cliente", "mismo_contexto"])("unión %s cambia contexto y navega", async (resultado) => {
    dueno(); montar(); await screen.findByRole("heading", { name: "¿Unirte a Barbería Demo?" }); expect(screen.getByRole("button", { name: "Unirme" })).toBeDisabled(); await screen.findByText("Aviso vigente"); fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
    if (resultado === "mismo_contexto") m.cambiar.mockRejectedValueOnce(new ApiError(409, { codigo: "mismo_contexto" })); else m.api.mockResolvedValueOnce({ estado: resultado, negocio_id: "b1", nombre_comercial: "Barbería Demo" });
    fireEvent.click(screen.getByRole("button", { name: "Unirme" })); await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: "/" })); expect(m.cambiar).toHaveBeenCalledWith({ rol: "cliente", negocio_id: "b1" }); expect(m.toast).toHaveBeenCalledWith("Ya eres cliente de Barbería Demo");
  });
  it("cliente dado de baja no cambia contexto", async () => { dueno(); montar(); await screen.findByText("Aviso vigente"); fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" })); m.api.mockRejectedValueOnce(new ApiError(409, { codigo: "cliente_dado_de_baja" })); fireEvent.click(screen.getByRole("button", { name: "Unirme" })); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ya fuiste cliente")); expect(m.cambiar).not.toHaveBeenCalled(); });
  it.each([[409, "tope_negocio", "muchas solicitudes pendientes"], [400, "nacimiento_invalido", "Esa fecha no existe"]])("error %s %s", async (status, codigo, texto) => { montar(); await llenar(); m.api.mockRejectedValueOnce(new ApiError(status as number, { codigo })); enviar(); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(texto as string)); });
  it("429 cuenta regresiva", async () => { montar(); await llenar(); vi.useFakeTimers(); m.api.mockRejectedValueOnce(new ApiError(429, {}, 3)); await act(async () => enviar()); expect(screen.getByRole("button", { name: "Enviar mi registro" })).toBeDisabled(); expect(screen.getByRole("status")).toHaveTextContent("Espera 3 s"); await act(async () => vi.advanceTimersByTime(3000)); expect(screen.getByRole("button", { name: "Enviar mi registro" })).toBeEnabled(); });
});
describe("P42 Caja", () => {
  it.each([false, true])("aprobar con Enter=%s reusa alta", async (enter) => { await caja(); expect(screen.getByText("Correo: n***@correo.mx")).toBeInTheDocument(); if (enter) fireEvent.keyDown(window, { key: "Enter" }); else fireEvent.click(screen.getByRole("button", { name: /^Aprobar registro/ })); await waitFor(() => expect(m.hecha).toHaveBeenCalledWith("5512345678", alta)); expect(m.ejecutar).toHaveBeenCalledTimes(2); });
  it("202 reusa respuesta pendiente", async () => { await caja(); const r = { pendiente: true, validacion_id: "v1", estado: "pendiente", expira_en: pendiente.expira_en }; m.api.mockResolvedValueOnce(r); fireEvent.click(screen.getByRole("button", { name: /^Aprobar registro/ })); await waitFor(() => expect(m.hecha).toHaveBeenCalledWith("5512345678", r)); });
  it("404 avisa y vuelve a buscar", async () => { await caja(); m.api.mockRejectedValueOnce(new ApiError(404, { codigo: "solicitud_no_encontrada" })); fireEvent.click(screen.getByRole("button", { name: /^Aprobar registro/ })); await waitFor(() => expect(m.api.mock.calls.filter(([p]) => p === "/api/clientes/busqueda")).toHaveLength(2)); expect(m.toast).toHaveBeenCalledWith("La solicitud ya no existe (venció o ya se atendió)"); });
  it("rechazo requiere confirmar y muestra alta normal", async () => { await caja(); fireEvent.click(screen.getByRole("button", { name: "Rechazar" })); expect(m.api).not.toHaveBeenCalledWith("/api/clientes/solicitudes-registro/sol-1", expect.anything()); fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Rechazar" })); await screen.findByText("Este teléfono aún no es cliente"); expect(m.api).toHaveBeenCalledWith("/api/clientes/solicitudes-registro/sol-1", { method: "DELETE" }); });
  it("sin solicitud conserva alta", async () => { dueno(); m.api.mockResolvedValue({ encontrado: false }); montar(<PasoBuscar inicial="5512345678" onAlta={m.alta} onEncontrado={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: /^Buscar/ })); await screen.findByText("Este teléfono aún no es cliente"); fireEvent.click(screen.getByRole("button", { name: /^Dar de alta/ })); expect(m.alta).toHaveBeenCalledWith("5512345678"); });
});
describe("P42 QR y cartel", () => {
  async function abrir() { dueno(); montar(<BotonQrRegistro />); await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo")); await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" })); }
  it("copia enlace exacto y foco Tab permanece en capa", async () => { await abrir(); const enlace = `${location.origin}/registro#c=ABC123`; expect(screen.getByLabelText("Enlace de registro")).toHaveValue(enlace); fireEvent.keyDown(window, { key: "Tab" }); expect(screen.getByLabelText("Enlace de registro")).toHaveFocus(); fireEvent.keyDown(window, { key: "Tab" }); expect(screen.getByRole("button", { name: "Copiar enlace" })).toHaveFocus(); fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" })); await screen.findByRole("button", { name: "¡Copiado!" }); expect(navigator.clipboard.writeText).toHaveBeenCalledWith(enlace); fireEvent.keyDown(window, { key: "Escape" }); });
  it("falla portapapeles permite copiar manualmente", async () => { await abrir(); vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error()); fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" })); await screen.findByText("Mantén presionado el enlace para copiarlo"); await waitFor(() => expect(screen.getByLabelText("Enlace de registro")).toHaveFocus()); fireEvent.keyDown(window, { key: "Escape" }); });
  it("404 sin campo ni copiar", async () => { dueno(); m.api.mockRejectedValue(new ApiError(404, {})); montar(<BotonQrRegistro />); await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" })); expect(screen.queryByLabelText("Enlace de registro")).toBeNull(); expect(screen.queryByRole("button", { name: "Copiar enlace" })).toBeNull(); fireEvent.keyDown(window, { key: "Escape" }); });
  it("renueva solo tras confirmar y actualiza QR", async () => { dueno(); montar(<CartelRegistro />); await waitFor(() => expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/registro#c=ABC123`)); fireEvent.click(screen.getByRole("button", { name: "Generar enlace nuevo" })); expect(m.api).not.toHaveBeenCalledWith("/api/registro/mi-codigo/nuevo", expect.anything()); fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Generar enlace nuevo" })); await waitFor(() => expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/registro#c=NUEVO12`)); expect(clients[0]?.getQueryData(["mi-codigo-registro"])).toEqual({ codigo: "NUEVO12" }); expect(m.toast).toHaveBeenCalledWith("Listo: el enlace anterior ya no funciona"); });
  it("cartel muestra el campo y lo actualiza al renovar", async () => {
    dueno(); montar(<CartelRegistro />);
    await waitFor(() => expect(screen.getByLabelText("Enlace de registro")).toHaveValue(`${location.origin}/registro#c=ABC123`));
    fireEvent.click(screen.getByRole("button", { name: "Generar enlace nuevo" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Generar enlace nuevo" }));
    await waitFor(() => expect(screen.getByLabelText("Enlace de registro")).toHaveValue(`${location.origin}/registro#c=NUEVO12`));
  });
  it("empleado no renueva", async () => { m.sesion = { contexto: { rol: "empleado", nombre_comercial: "Barbería Demo" } }; montar(<CartelRegistro />); await screen.findByText(/Este cartel abre/); expect(screen.queryByRole("button", { name: "Generar enlace nuevo" })).toBeNull(); });
});
