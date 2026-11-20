import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { CopiarEnlace } from "@/components/copiar-enlace";
import { BotonQrRegistro } from "@/components/qr-registro";
import { PasoBuscar } from "@/components/caja/paso-buscar";
import { Registro } from "@/routes/registro";
import { Route as LoginRoute } from "@/routes/login";

const m = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), toast: vi.fn(), alta: vi.fn(), search: {} as Record<string, unknown>, sesion: null as null | { contexto: { rol: string; nombre_comercial: string } } }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/lib/api/auth", () => ({ cambiarContexto: vi.fn(), logout: vi.fn(), login: vi.fn() }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: m.sesion ? "autenticado" : "anonimo", sesion: m.sesion }) }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options, useSearch: () => m.search }), useNavigate: () => m.navigate, Link: ({ to, children, ...props }: { to: string; children: ReactNode; search?: unknown }) => { const { search: _s, ...rest } = props as Record<string, unknown>; return <a href={to} {...rest}>{children}</a>; } }));
vi.mock("sonner", () => ({ toast: { success: m.toast, error: m.toast, info: m.toast } }));
vi.mock("@/components/caja/caja-contexto", () => ({ useCaja: () => ({ ejecutar: (fn: () => unknown) => fn(), moneda: "MXN" }), avisarError: m.toast }));
vi.mock("@/components/continuar-sesion", () => ({ ContinuarSesion: () => null, destinoSeguro: (v: string | null) => v }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: () => <svg aria-label="Código QR de registro" /> }));

const clients: QueryClient[] = [];
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
const dueno = (nombre = "Barbería Demo") => { m.sesion = { contexto: { rol: "dueno", nombre_comercial: nombre } }; };
const enlace = "https://x.test/registro#c=ABC123";
let miCodigo404 = false;
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); m.sesion = null; m.search = {}; miCodigo404 = false; history.replaceState(null, "", "/registro#c=ABC123");
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/registro/mi-codigo") { if (miCodigo404) throw new ApiError(404, {}); return { codigo: "ABC123" }; }
    if (path === "/api/clientes/busqueda") return { encontrado: false };
    if (path === "/api/registro/negocio") return { nombre_comercial: "Barbería Demo" };
    if (path === "/api/aviso-privacidad") return { version: "v1", resumen: "Aviso vigente", vigente: true };
    if (path === "/api/registro/solicitar") return { estado: "pendiente", expira_en: "2026-11-20T20:00:00Z" };
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); Reflect.deleteProperty(navigator, "share"); vi.restoreAllMocks(); });

describe("P43 Compartir", () => {
  it("usa navigator.share con título, texto y url", async () => {
    const share = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<CopiarEnlace enlace={enlace} nombreNegocio="Café & Pan" />);
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Mi Saldo Vip", text: "Únete a Café & Pan en Mi Saldo Vip y gana cashback en cada compra:", url: enlace }));
  });
  it("cancelar no abre wa.me ni muestra error", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")) });
    render(<CopiarEnlace enlace={enlace} nombreNegocio="Café" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Compartir" })); });
    expect(open).not.toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled();
  });
  it("sin navigator.share abre WhatsApp con mensaje completo", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<CopiarEnlace enlace={enlace} nombreNegocio="Café 100% natural" />);
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(`Únete a Café 100% natural en Mi Saldo Vip y gana cashback en cada compra: ${enlace}`)}`, "_blank", "noopener,noreferrer"));
  });
  it("capa del QR: Tab recorre campo, Copiar, Compartir y Cerrar", async () => {
    dueno(); montar(<BotonQrRegistro />);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo")); await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" }));
    expect(screen.getByText("Envíaselo al cliente si no puede escanear el código.")).toBeInTheDocument();
    const orden = [screen.getByLabelText("Enlace de registro"), screen.getByRole("button", { name: "Copiar enlace" }), screen.getByRole("button", { name: "Compartir" }), screen.getByRole("button", { name: "Cerrar" })];
    for (const el of [...orden, orden[0]]) { fireEvent.keyDown(window, { key: "Tab" }); expect(el).toHaveFocus(); }
    fireEvent.keyDown(window, { key: "Escape" });
  });
});

describe("P43 Caja", () => {
  async function caja() { dueno(); montar(<PasoBuscar inicial="5512345678" onAlta={m.alta} onEncontrado={vi.fn()} />); await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo")); await act(async () => {}); fireEvent.click(screen.getByRole("button", { name: /^Buscar/ })); await screen.findByText("Este teléfono aún no es cliente"); }
  it("abre la misma capa y al cerrar conserva número y tarjeta; Enter da de alta", async () => {
    await caja();
    fireEvent.click(screen.getByRole("button", { name: "Que se registre desde su celular" }));
    expect(screen.getByRole("dialog", { name: "QR de registro" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("55 1234 5678")).toBeInTheDocument(); expect(screen.getByText("Este teléfono aún no es cliente")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" }); expect(m.alta).toHaveBeenCalledWith("5512345678");
  });
  it("con enlace de bienvenida no aparece", async () => { miCodigo404 = true; await caja(); expect(screen.queryByRole("button", { name: "Que se registre desde su celular" })).toBeNull(); });
});

async function llenar() {
  await screen.findByRole("heading", { name: "Únete a Barbería Demo" });
  for (const [label, value] of [["Nombre", "Nora"], ["Apellido paterno", "López"], ["Día", "3"], ["Mes", "2"], ["Correo electrónico", "n@c.mx"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await screen.findByText("Aviso vigente"); fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
}
const Login = (LoginRoute as unknown as { options: { component: ComponentType } }).options.component;
const validar = (LoginRoute as unknown as { options: { validateSearch: (s: Record<string, unknown>) => Record<string, unknown> } }).options.validateSearch;
describe("P43 Registro y login", () => {
  it("pendiente muestra el número en grande", async () => {
    montar(<Registro />); await llenar(); fireEvent.change(screen.getByLabelText("Tu celular (10 dígitos)"), { target: { value: "5590420001" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" }));
    await screen.findByText("Dile este número al cajero:"); expect(screen.getByText("55 9042 0001")).toBeInTheDocument();
  });
  it("cuenta existente lleva el teléfono al login y enfoca el PIN", async () => {
    montar(<Registro />); await llenar(); fireEvent.change(screen.getByLabelText("Tu celular (10 dígitos)"), { target: { value: "5510000021" } });
    m.api.mockResolvedValueOnce({ estado: "cuenta_existente" }); fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" }));
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar sesión" }));
    // Claude: QR-A8, el teléfono viaja en sessionStorage y no en la URL; se borra al leerlo.
    expect(m.navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(sessionStorage.getItem("misaldo.telefono-prellenado")).toBe("5510000021");
    cleanup(); m.search = validar({}); render(<Login />);
    expect(screen.getByLabelText("Teléfono (10 dígitos)")).toHaveValue("5510000021");
    await waitFor(() => expect(screen.getByLabelText("PIN")).toHaveFocus());
    expect(sessionStorage.getItem("misaldo.telefono-prellenado")).toBeNull();
  });
  it("telefono inválido se ignora", () => {
    sessionStorage.setItem("misaldo.telefono-prellenado", "123");
    m.search = validar({ telefono: "5510000021" }); expect(m.search).toEqual({}); render(<Login />); // Claude: QR-A8, ?telefono= ya no se lee
    expect(screen.getByLabelText("Teléfono (10 dígitos)")).toHaveValue(""); expect(screen.getByLabelText("PIN")).not.toHaveFocus();
  });
});
