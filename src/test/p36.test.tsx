import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { leerCodigoRegistro, negocioRegistro, solicitarRegistro, verificarRegistro, reenviarRegistro, miCodigoRegistro } from "@/lib/api/registro";
import { Registro } from "@/routes/registro";
import { BotonQrRegistro } from "@/components/qr-registro";
import { GuardaSitio } from "@/components/guarda-sitio";
import { CompletarActivacion } from "@/components/completar-activacion";

const m = vi.hoisted(() => ({ api: vi.fn(), sitio: "desarrollo", pathname: "/registro", completar: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>, useNavigate: () => m.navigate, useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: m.pathname } }) }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "anonimo", sesion: { contexto: { rol: "dueno", nombre_comercial: "Barbería Demo" } } }) }));
vi.mock("@/lib/sitio", async (original) => ({ ...await original<typeof import("@/lib/sitio")>(), sitioActual: () => m.sitio }));
vi.mock("@/lib/api/enlaces", async (original) => ({ ...await original<typeof import("@/lib/api/enlaces")>(), completarActivacion: m.completar }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg aria-label="Código QR de registro" data-value={value} /> }));
const clients: QueryClient[] = [];
const aviso = { version: "v1", resumen: "Aviso vigente", vigente: true };
function montar(children: ReactNode = <Registro />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks(); m.sitio = "desarrollo"; history.replaceState(null, "", "/registro#c=ABC123");
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/aviso-privacidad") return aviso;
    if (path === "/api/registro/negocio/ABC123") return { nombre_comercial: "Barbería Demo" };
    if (path === "/api/registro/solicitar") return { token_registro: "registro", expira_en_seg: 900, reenviar_en_seg: 3 };
    if (path === "/api/registro/verificar") return { estado: "ya_registrado" };
    if (path === "/api/registro/reenviar") return { reenviar_en_seg: 5 };
    if (path === "/api/registro/mi-codigo") throw new ApiError(404, {});
    throw new Error(`API inesperada ${path}`);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.useRealTimers(); });
async function datos(aceptar = true) {
  await screen.findByRole("heading", { name: "Únete a Barbería Demo" });
  fireEvent.change(screen.getByLabelText("¿Cómo te llamas?"), { target: { value: "  Ana López  " } });
  fireEvent.change(screen.getByLabelText("Tu celular (10 dígitos)"), { target: { value: "55 1234 5678" } });
  await screen.findByText("Aviso vigente");
  if (aceptar) fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
}
async function codigo() { montar(); await datos(); fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" })); await screen.findByText("Te enviamos un código por WhatsApp al 55 1234 5678."); }
function ingresar() { fireEvent.change(screen.getByRole("textbox", { name: "Código que te llegó (6 dígitos)" }), { target: { value: "582047" } }); }

describe("P36 código y contrato", () => {
  it.each(["ABC123", "a_B-12", "A".repeat(32)])("acepta %s", (c) => expect(leerCodigoRegistro(`#c=${c}`)).toBe(c));
  it.each(["#c=ABCDE", `#c=${"A".repeat(33)}`, "#c=a%2Bb123", "#c=", "#n=ABC123", ""])("rechaza %s", (hash) => expect(leerCodigoRegistro(hash)).toBeNull());
  it("codifica el negocio y conserva los cinco contratos de API", async () => {
    m.api.mockResolvedValue({});
    await negocioRegistro("A/B+ C"); expect(m.api).toHaveBeenLastCalledWith("/api/registro/negocio/A%2FB%2B%20C", { auth: false });
    const cuerpo = { codigo: "ABC123", nombre: "Ana López", telefono: "+525512345678", acepta_aviso_privacidad: true as const, version_aviso: "v1", acepta_promociones: false };
    await solicitarRegistro(cuerpo); expect(m.api).toHaveBeenLastCalledWith("/api/registro/solicitar", { auth: false, method: "POST", body: cuerpo });
    await verificarRegistro("t", "123456"); expect(m.api).toHaveBeenLastCalledWith("/api/registro/verificar", { auth: false, method: "POST", body: { token_registro: "t", codigo: "123456" } });
    await reenviarRegistro("t"); expect(m.api).toHaveBeenLastCalledWith("/api/registro/reenviar", { auth: false, method: "POST", body: { token_registro: "t" } });
    await miCodigoRegistro(); expect(m.api).toHaveBeenLastCalledWith("/api/registro/mi-codigo");
  });
});

describe("P36 registro", () => {
  it("sin código no consulta el negocio", async () => { history.replaceState(null, "", "/registro"); montar(); await screen.findByRole("heading", { name: "Registro no disponible" }); expect(m.api).not.toHaveBeenCalled(); });
  it.each([404, 500])("negocio %s no disponible y elimina fragmento", async (status) => { m.api.mockRejectedValue(new ApiError(status, {})); montar(); await screen.findByRole("heading", { name: "Registro no disponible" }); expect(location.hash).toBe(""); });
  it("requiere consentimiento y envía datos exactos con promociones desmarcadas", async () => {
    montar(); await datos(false); fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" }));
    expect(m.api.mock.calls.some(([path]) => path === "/api/registro/solicitar")).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" })); fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" }));
    await screen.findByText("Te enviamos un código por WhatsApp al 55 1234 5678.");
    expect(m.api).toHaveBeenCalledWith("/api/registro/solicitar", { auth: false, method: "POST", body: { codigo: "ABC123", nombre: "Ana López", telefono: "+525512345678", acepta_aviso_privacidad: true, version_aviso: "v1", acepta_promociones: false } });
  });
  it("429 usa Retry-After y libera solicitud al terminar", async () => {
    montar(); await datos(); vi.useFakeTimers(); m.api.mockRejectedValueOnce(new ApiError(429, {}, 4));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" })); });
    expect(screen.getByText("Espera 4 s para volver a intentar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviarme el código" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(4000)); expect(screen.getByRole("button", { name: "Enviarme el código" })).toBeEnabled();
  });
  it("código inválido muestra un intento y limpia; token vencido conserva datos", async () => {
    await codigo(); m.api.mockRejectedValueOnce(new ApiError(400, { codigo: "codigo_invalido", intentos_restantes: 1 })); ingresar();
    await screen.findByText("El código no es correcto. Te queda 1 intento"); expect(screen.getByRole("textbox", { name: "Código que te llegó (6 dígitos)" })).toHaveValue("");
    m.api.mockRejectedValueOnce(new ApiError(400, { codigo: "token_invalido" })); ingresar(); await screen.findByText("El código venció. Pide uno nuevo.");
    expect(screen.getByLabelText("¿Cómo te llamas?")).toHaveValue("Ana López"); expect(screen.getByLabelText("Tu celular (10 dígitos)")).toHaveValue("55 1234 5678");
  });
  it("reenvío espera, se habilita, usa valor nuevo y Retry-After", async () => {
    montar(); await datos(); vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" })); });
    const boton = screen.getByRole("button", { name: "Reenviar código" }); expect(boton).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(3000)); expect(boton).toBeEnabled();
    await act(async () => { fireEvent.click(boton); }); expect(boton).toBeDisabled(); expect(screen.getByText("Espera 5 s para volver a intentar.")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(5000)); m.api.mockRejectedValueOnce(new ApiError(429, {}, 7)); await act(async () => { fireEvent.click(boton); });
    expect(screen.getByText("Espera 7 s para volver a intentar.")).toBeInTheDocument(); expect(boton).toBeDisabled();
  });
  it("ya registrado entra por login", async () => { await codigo(); ingresar(); expect(await screen.findByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login"); });
  it("activar reutiliza consentimiento vigente", async () => {
    await codigo(); m.api.mockResolvedValueOnce({ estado: "activar", token_activacion: "activacion" }); ingresar();
    await screen.findByRole("button", { name: /Tu PIN/ }); await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toBeNull());
  });
  it("409 conserva datos y pide aceptar el aviso nuevo", async () => {
    montar(); await datos(); const original = m.api.getMockImplementation();
    m.api.mockImplementation(async (path: string) => path === "/api/aviso-privacidad" ? { ...aviso, version: "v2" } : original?.(path));
    m.api.mockRejectedValueOnce(new ApiError(409, { codigo: "aviso_desactualizado" })); fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByLabelText("¿Cómo te llamas?")).toHaveValue("Ana López");
  });
  it("consentimiento de otra versión se muestra de nuevo", async () => { montar(<CompletarActivacion token="t" versionAvisoAceptada="v0" onExpirado={vi.fn()} />); expect(await screen.findByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toBeInTheDocument(); });
  it.each(["A", "a".repeat(81)])("rechaza nombre fuera de 2 a 80 caracteres: %s", async (nombre) => {
    montar(); await datos(); fireEvent.change(screen.getByLabelText("¿Cómo te llamas?"), { target: { value: nombre } });
    fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" }));
    expect(m.api.mock.calls.some(([path]) => path === "/api/registro/solicitar")).toBe(false);
  });
  it("promociones marcadas se envían como true", async () => {
    montar(); await datos(); fireEvent.click(screen.getByRole("checkbox", { name: /Quiero recibir promociones/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enviarme el código" }));
    await screen.findByText("Te enviamos un código por WhatsApp al 55 1234 5678.");
    expect(m.api).toHaveBeenCalledWith("/api/registro/solicitar", expect.objectContaining({ body: expect.objectContaining({ acepta_promociones: true }) }));
  });
  it("activación envía la versión heredada y notifica expiración", async () => {
    const expirado = vi.fn(); m.completar.mockRejectedValue(new ApiError(400, { codigo: "token_invalido" }));
    montar(<CompletarActivacion token="activacion" versionAvisoAceptada="v1" onExpirado={expirado} />);
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toBeNull());
    const digitos = (n: string) => { for (const d of n) fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${d}$`) })); };
    digitos("582047"); fireEvent.click(screen.getByRole("button", { name: /Código de acumulación \(4 dígitos\)/ })); digitos("5821");
    fireEvent.click(screen.getByRole("button", { name: /Código de canje \(4 dígitos\)/ })); digitos("7394");
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));
    await waitFor(() => expect(expirado).toHaveBeenCalledOnce());
    expect(m.completar).toHaveBeenCalledWith({ token_activacion: "activacion", pin: "582047", codigo_acumulacion: "5821", codigo_canje: "7394", correo: null, acepta_aviso_privacidad: true, version_aviso: "v1" });
  });
  it("admin oculta registro sin consultar su API", () => { m.sitio = "admin"; montar(<GuardaSitio><Registro /></GuardaSitio>); expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument(); expect(m.api).not.toHaveBeenCalled(); });
  it.each([false, true])("QR elige registro disponible=%s", async (disponible) => {
    if (disponible) m.api.mockResolvedValue({ codigo: "ABC123" });
    montar(<BotonQrRegistro />); await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo"));
    await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/${disponible ? "registro#c=ABC123" : "bienvenida#n=Barber%C3%ADa%20Demo"}`);
    fireEvent.keyDown(window, { key: "Escape" });
  });
  it("QR mantiene registro durante una consulta con un código anterior en caché", async () => {
    m.api.mockReturnValue(new Promise(() => {}));
    const client = new QueryClient(); clients.push(client);
    client.setQueryData(["mi-codigo-registro"], { codigo: "ABC123" }, { updatedAt: Date.now() - 6 * 60_000 });
    render(<QueryClientProvider client={client}><BotonQrRegistro /></QueryClientProvider>);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo"));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/registro#c=ABC123`);
    fireEvent.keyDown(window, { key: "Escape" });
  });
});
