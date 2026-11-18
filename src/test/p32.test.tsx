import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leerNegocioAviso, quitarNegocioAviso } from "@/lib/negocio-aviso";
import { ApiError } from "@/lib/api/client";

const A = "11111111-1111-1111-1111-111111111111";
const B = "3f2a0000-aaaa-bbbb-cccc-1234567890ab";
const m = vi.hoisted(() => ({
  contextos: vi.fn(), cambiar: vi.fn(), navigate: vi.fn(), success: vi.fn(), info: vi.fn(),
  auth: { estado: "autenticado", sesion: null as null | { contexto: object } },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/lib/api/auth", () => ({ contextos: m.contextos, cambiarContexto: m.cambiar }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => m.auth }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ updateBusiness: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: m.success, info: m.info } }));
const { CambioPorAviso } = await import("@/components/cambio-por-aviso");

const ctx = (rol: string, negocio_id: string, nombre: string) => ({ rol, negocio_id, nombre_comercial: nombre, actual: false, requiere_pin: false, requiere_totp: false });
function montar(url: string) {
  window.history.replaceState(null, "", url);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><CambioPorAviso><p>Pantalla canjear</p></CambioPorAviso></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  m.auth = { estado: "autenticado", sesion: { contexto: ctx("cliente", A, "Café A") } };
  m.contextos.mockResolvedValue({ contextos: [ctx("cliente", A, "Café A"), ctx("cliente", B, "Pan B")] });
  m.cambiar.mockResolvedValue({ contexto: ctx("cliente", B, "Pan B") });
});
afterEach(cleanup);

describe("P32 · parámetro negocio", () => {
  it("leerNegocioAviso", () => {
    expect(leerNegocioAviso(`?negocio=${B.toUpperCase()}`)).toBe(B);
    expect(leerNegocioAviso("?negocio=")).toBeNull();
    expect(leerNegocioAviso("?negocio=hola")).toBeNull();
    expect(leerNegocioAviso(`?negocio=${B}a`)).toBeNull();
    expect(leerNegocioAviso("?x=1")).toBeNull();
  });
  it("quitarNegocioAviso", () => {
    expect(quitarNegocioAviso("/canjear", `?a=1&negocio=${B}&b=2`, "#x")).toBe("/canjear?a=1&b=2#x");
    expect(quitarNegocioAviso("/canjear", `?negocio=${B}`, "")).toBe("/canjear");
  });
});

describe("P32 · CambioPorAviso", () => {
  it("sin parámetro: hijos de inmediato y sin API", () => {
    montar("/canjear");
    expect(screen.getByText("Pantalla canjear")).toBeTruthy();
    expect(m.contextos).not.toHaveBeenCalled();
    expect(m.cambiar).not.toHaveBeenCalled();
  });
  it("cliente de A con negocio B: cambia", async () => {
    montar(`/canjear?negocio=${B}`);
    expect(window.location.search).toBe("");
    await screen.findByText("Pantalla canjear");
    expect(m.cambiar).toHaveBeenCalledWith({ rol: "cliente", negocio_id: B });
    expect(m.success).toHaveBeenCalledWith("Ahora estás en Pan B · Cliente");
    expect(window.location.pathname).toBe("/canjear");
  });
  it("ya es cliente de B: no cambia", async () => {
    m.auth = { estado: "autenticado", sesion: { contexto: ctx("cliente", B, "Pan B") } };
    montar(`/canjear?negocio=${B}`);
    await screen.findByText("Pantalla canjear");
    expect(m.cambiar).not.toHaveBeenCalled();
  });
  it("B no está en la lista: sin cambio ni mensaje", async () => {
    m.contextos.mockResolvedValue({ contextos: [ctx("cliente", A, "Café A")] });
    montar(`/canjear?negocio=${B}`);
    await screen.findByText("Pantalla canjear");
    expect(m.cambiar).not.toHaveBeenCalled();
    expect(m.success).not.toHaveBeenCalled();
    expect(m.info).not.toHaveBeenCalled();
  });
  it("empleado: diálogo; Quedarme aquí no cambia, Ver la promoción sí", async () => {
    m.auth = { estado: "autenticado", sesion: { contexto: ctx("empleado", A, "Café A") } };
    montar(`/canjear?negocio=${B}`);
    await screen.findByText("Promoción de Pan B");
    expect(screen.getByText(/Para volver a Café A · Empleado te podemos pedir tu PIN/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quedarme aquí" }));
    expect(m.cambiar).not.toHaveBeenCalled();
    cleanup();
    montar(`/canjear?negocio=${B}`);
    fireEvent.click(await screen.findByRole("button", { name: "Ver la promoción" }));
    await waitFor(() => expect(m.cambiar).toHaveBeenCalledWith({ rol: "cliente", negocio_id: B }));
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: "/canjear", replace: true }));
  });
  it("cambio-contexto 500: hijos sin cambiar", async () => {
    m.cambiar.mockRejectedValue(new ApiError(500, { codigo: "error" }));
    montar(`/canjear?negocio=${B}`);
    await screen.findByText("Pantalla canjear");
    expect(m.success).not.toHaveBeenCalled();
  });
  it("anónimo: sin API", async () => {
    m.auth = { estado: "anonimo", sesion: null };
    montar(`/canjear?negocio=${B}`);
    await screen.findByText("Pantalla canjear");
    expect(m.contextos).not.toHaveBeenCalled();
    expect(m.cambiar).not.toHaveBeenCalled();
  });
});
