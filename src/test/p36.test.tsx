import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { leerCodigoRegistro, negocioRegistro, solicitarRegistro, miCodigoRegistro } from "@/lib/api/registro";
import { Registro } from "@/routes/registro";
import { BotonQrRegistro } from "@/components/qr-registro";
import { GuardaSitio } from "@/components/guarda-sitio";
import { CompletarActivacion } from "@/components/completar-activacion";

const m = vi.hoisted(() => ({ api: vi.fn(), sesion: false, sitio: "desarrollo", pathname: "/registro", completar: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>, useNavigate: () => m.navigate, useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: m.pathname } }) }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: m.sesion ? "autenticado" : "anonimo", sesion: m.sesion ? { contexto: { rol: "dueno", nombre_comercial: "Barbería Demo" } } : null }) }));
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
  vi.resetAllMocks(); m.sesion = false; m.sitio = "desarrollo"; history.replaceState(null, "", "/registro#c=ABC123");
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/aviso-privacidad") return aviso;
    if (path === "/api/registro/negocio") return { nombre_comercial: "Barbería Demo" };
    if (path === "/api/registro/solicitar") return { estado: "pendiente", expira_en: "2026-11-21T00:00:00Z" };
    if (path === "/api/registro/verificar") return { estado: "ya_registrado" };
    if (path === "/api/registro/reenviar") return { reenviar_en_seg: 5 };
    if (path === "/api/registro/mi-codigo") throw new ApiError(404, {});
    throw new Error(`API inesperada ${path}`);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.useRealTimers(); });
async function datos(aceptar = true) {
  await screen.findByRole("heading", { name: "Únete a Barbería Demo" });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Ana  " } });
  fireEvent.change(screen.getByLabelText("Apellido paterno"), { target: { value: "López" } });
  fireEvent.change(screen.getByLabelText("Día"), { target: { value: "29" } });
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.mx" } });
  fireEvent.change(screen.getByLabelText("Tu celular (10 dígitos)"), { target: { value: "55 1234 5678" } });
  await screen.findByText("Aviso vigente");
  if (aceptar) fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
}
describe("P36 código y contrato", () => {
  it.each(["ABC123", "a_B-12", "A".repeat(32)])("acepta %s", (c) => expect(leerCodigoRegistro(`#c=${c}`)).toBe(c));
  it.each(["#c=ABCDE", `#c=${"A".repeat(33)}`, "#c=a%2Bb123", "#c=", "#n=ABC123", ""])("rechaza %s", (hash) => expect(leerCodigoRegistro(hash)).toBeNull());
  it("codifica el negocio y conserva los contratos vigentes de API", async () => {
    m.api.mockResolvedValue({});
    await negocioRegistro("A/B+ C"); expect(m.api).toHaveBeenLastCalledWith("/api/registro/negocio", { method: "POST", body: { codigo: "A/B+ C" }, auth: false }); // Claude: QR-A12, el código en el cuerpo
    const cuerpo = { codigo: "ABC123", nombre: "Ana López", telefono: "+525512345678", acepta_aviso_privacidad: true as const, version_aviso: "v1", apellido_paterno: "López", nacimiento_dia: 29, nacimiento_mes: 2, correo: "ana@example.mx" };
    await solicitarRegistro(cuerpo); expect(m.api).toHaveBeenLastCalledWith("/api/registro/solicitar", { auth: false, method: "POST", body: cuerpo });
    await miCodigoRegistro(); expect(m.api).toHaveBeenLastCalledWith("/api/registro/mi-codigo");
  });
});

describe("P36 registro", () => {
  it("sin código no consulta el negocio", async () => { history.replaceState(null, "", "/registro"); montar(); await screen.findByRole("heading", { name: "Registro no disponible" }); expect(m.api).not.toHaveBeenCalled(); });
  it.each([404, 500])("negocio %s no disponible y elimina fragmento", async (status) => { m.api.mockRejectedValue(new ApiError(status, {})); montar(); await screen.findByRole("heading", { name: "Registro no disponible" }); expect(location.hash).toBe(""); });
  it("429 usa Retry-After y libera solicitud al terminar", async () => {
    montar(); await datos(); vi.useFakeTimers(); m.api.mockRejectedValueOnce(new ApiError(429, {}, 4));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" })); });
    expect(screen.getByText("Espera 4 s para volver a intentar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar mi registro" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(4000)); expect(screen.getByRole("button", { name: "Enviar mi registro" })).toBeEnabled();
  });
  it("409 conserva datos y pide aceptar el aviso nuevo", async () => {
    montar(); await datos(); const original = m.api.getMockImplementation();
    m.api.mockImplementation(async (path: string) => path === "/api/aviso-privacidad" ? { ...aviso, version: "v2" } : original?.(path));
    m.api.mockRejectedValueOnce(new ApiError(409, { codigo: "aviso_desactualizado" })); fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
  });
  it("consentimiento de otra versión se muestra de nuevo", async () => { montar(<CompletarActivacion token="t" versionAvisoAceptada="v0" onExpirado={vi.fn()} />); expect(await screen.findByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toBeInTheDocument(); });
  it("activación envía la versión heredada y notifica expiración", async () => {
    const expirado = vi.fn(); m.completar.mockRejectedValue(new ApiError(400, { codigo: "token_invalido" }));
    montar(<CompletarActivacion token="activacion" versionAvisoAceptada="v1" onExpirado={expirado} />);
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Acepto el aviso de privacidad" })).toBeNull());
    const digitos = (n: string) => {
      const teclado = document.querySelector(".grid.grid-cols-3");
      if (!teclado) throw new Error("No hay teclado numérico abierto");
      for (const d of n) fireEvent.click(within(teclado as HTMLElement).getByRole("button", { name: d }));
    };
    digitos("582047"); fireEvent.click(screen.getByRole("button", { name: /^PIN de acumulación \(4 dígitos\)$/ })); digitos("5821");
    fireEvent.click(screen.getByRole("button", { name: /^PIN de canje \(4 dígitos\)$/ })); digitos("7394");
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));
    await waitFor(() => expect(expirado).toHaveBeenCalledOnce());
    expect(m.completar).toHaveBeenCalledWith({ token_activacion: "activacion", pin: "582047", codigo_acumulacion: "5821", codigo_canje: "7394", correo: null, acepta_aviso_privacidad: true, version_aviso: "v1" });
  }, 60_000);
  it("admin oculta registro sin consultar su API", () => { m.sitio = "admin"; montar(<GuardaSitio><Registro /></GuardaSitio>); expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument(); expect(m.api).not.toHaveBeenCalled(); });
  it.each([false, true])("QR elige registro disponible=%s", async (disponible) => {
    m.sesion = true;
    if (disponible) m.api.mockResolvedValue({ codigo: "ABC123" });
    montar(<BotonQrRegistro />); await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo"));
    await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByLabelText("Código QR de registro")).toHaveAttribute("data-value", `${location.origin}/${disponible ? "registro#c=ABC123" : "bienvenida#n=Barber%C3%ADa%20Demo"}`);
    fireEvent.keyDown(window, { key: "Escape" });
  });
  it("QR mantiene registro durante una consulta con un código anterior en caché", async () => {
    m.sesion = true;
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
