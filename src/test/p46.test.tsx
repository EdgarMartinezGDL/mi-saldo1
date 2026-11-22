import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TusPines } from "@/components/cuenta/tus-pines";
import { Route as InicioRoute } from "@/routes/index";
import { ApiError } from "@/lib/api/client";

const m = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), rol: "cliente", negocio: "uno" }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => m.navigate, Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: m.rol, negocio_id: m.negocio } }, conectado: true }) }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ updateBusiness: () => {} }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@/components/invitar-instalar", () => ({ InvitarInstalar: () => null }));

const disponible = { codigo_canje: "9753", estado: "disponible", codigo_canje_bloqueado_hasta: null, codigo_canje_requiere_cambio: false };
let qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); m.rol = "cliente"; m.negocio = "uno";
  m.api.mockImplementation(async (path: string) => {
    if (path === "/api/perfil/codigos/acumulacion") return { codigo_acumulacion: "2580" };
    if (path === "/api/perfil/codigos/canje/consulta") return disponible;
    if (path === "/api/perfil/codigos") return { advertencias: [] };
    if (path === "/api/cliente/resumen") return { negocio: { nombre_comercial: "Café", moneda: "MXN" }, tarjetas: [] };
    if (path === "/api/cliente/perfil") return { telefono: "+525512345678", nombre: "Nora" };
    return {};
  });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); qc.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
function montar(ui: ReactNode = <TusPines telefono="+525512345678" />) { return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>); }
const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de canje", exact: true }));
const escribirAcceso = (valor = "582739") => fireEvent.change(screen.getByLabelText("PIN de acceso (6 dígitos)", { exact: true }), { target: { value: valor } });
async function revelar() { abrir(); escribirAcceso(); fireEvent.click(screen.getByRole("button", { name: "Ver mi PIN de canje" })); await act(async () => {}); }

describe("P46 consulta bajo demanda", () => {
  it("no consulta los PIN al cargar Inicio y no aparece para otro rol", async () => {
    const Inicio = (InicioRoute as unknown as { options: { component: ComponentType } }).options.component;
    const vista = montar(<Inicio />);
    await screen.findByText("Tus PINes");
    expect(m.api.mock.calls.some(([path]) => String(path).includes("/codigos"))).toBe(false);
    expect(screen.getAllByText("••••")).toHaveLength(2);
    m.rol = "dueno"; vista.rerender(<QueryClientProvider client={qc}><Inicio /></QueryClientProvider>);
    expect(screen.queryByText("Tus PINes")).toBeNull();
  });
  it("consulta acumulación únicamente al tocar y borra a los 30 segundos", async () => {
    vi.useFakeTimers(); montar(); expect(m.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de acumulación" })); await act(async () => {});
    expect(m.api).toHaveBeenCalledWith("/api/perfil/codigos/acumulacion"); expect(screen.getByText("2580")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(29_000)); expect(screen.getByText("2580")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000)); expect(screen.queryByText("2580")).toBeNull();
  });
  it("acumulación opcional sin PIN", async () => {
    m.api.mockResolvedValue({ codigo_acumulacion: null }); montar();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de acumulación" }));
    await screen.findByText("Aún no tienes PIN de acumulación. No es obligatorio.");
    expect(screen.getByRole("link", { name: "Crear PIN de acumulación" })).toHaveAttribute("href", "/canjear");
  });
  it("requiere seis dígitos y hace POST con el PIN de acceso; cuenta 30 segundos", async () => {
    vi.useFakeTimers(); montar(); abrir(); escribirAcceso("58273");
    expect(screen.getByRole("button", { name: "Ver mi PIN de canje" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Olvidé mi PIN de acceso" })).toHaveAttribute("href", "/recuperar");
    escribirAcceso(); fireEvent.click(screen.getByRole("button", { name: "Ver mi PIN de canje" })); await act(async () => {});
    expect(m.api).toHaveBeenCalledWith("/api/perfil/codigos/canje/consulta", { method: "POST", body: { pin: "582739" } });
    expect(screen.getByText("9753")).toBeInTheDocument(); expect(screen.getByText("Se ocultará en 30 s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000)); expect(screen.getByText("Se ocultará en 29 s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(29_000)); expect(screen.queryByText("9753")).toBeNull(); expect(screen.getAllByText("••••")).toHaveLength(2);
  });
  it.each(["sin_codigo", "sin_copia"])("respeta el estado %s del servidor", async (estado) => {
    m.api.mockResolvedValue({ ...disponible, estado, codigo_canje: null }); montar(); await revelar();
    expect(screen.queryByText("9753")).toBeNull();
    expect(screen.getByRole("button", { name: estado === "sin_codigo" ? "Crear PIN de canje" : "Cambiar PIN de canje" })).toBeInTheDocument();
  });
  it("muestra tres intentos restantes y nunca revela al fallar el acceso", async () => {
    m.api.mockRejectedValue(new ApiError(422, { codigo: "pin_incorrecto", intentos_restantes: 3 })); montar(); await revelar();
    expect(screen.getByRole("alert")).toHaveTextContent("Tu PIN de acceso (6 dígitos) es incorrecto"); expect(screen.getByRole("alert")).toHaveTextContent("Te quedan 3 intentos");
    expect(screen.queryByText("9753")).toBeNull(); expect(screen.getByLabelText("PIN de acceso (6 dígitos)", { exact: true })).toHaveValue("");
  });
  it("401 conserva el flujo existente de sesión terminada", async () => {
    m.api.mockRejectedValue(new ApiError(401, { codigo: "sesion_cerrada" })); montar(); await revelar();
    expect(m.navigate).toHaveBeenCalledWith({ to: "/login", replace: true }); expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("429 conserva el PIN oculto", async () => {
    m.api.mockRejectedValue(new ApiError(429, {})); montar(); await revelar(); expect(screen.getByRole("alert")).toHaveTextContent("Consultaste tu PIN de canje muchas veces. Intenta más tarde."); expect(screen.queryByText("9753")).toBeNull();
  });
});
describe("P46 secretos efímeros", () => {
  it("no persiste canje y borra ambos PIN al ocultar la pestaña", async () => {
    montar(); fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de acumulación" })); await screen.findByText("2580"); await revelar();
    expect(JSON.stringify(qc.getQueryCache().getAll())).not.toContain("9753"); expect(JSON.stringify(localStorage)).not.toContain("9753"); expect(JSON.stringify(sessionStorage)).not.toContain("9753");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByText("9753")).toBeNull(); expect(screen.queryByText("2580")).toBeNull();
  });
  it("descarta una respuesta que llega después de ocultar la pestaña", async () => {
    let resolver: ((r: typeof disponible) => void) | undefined;
    m.api.mockImplementation(() => new Promise((resolve) => { resolver = resolve; })); montar(); abrir(); escribirAcceso(); fireEvent.click(screen.getByRole("button", { name: "Ver mi PIN de canje" }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { resolver?.(disponible); }); expect(screen.queryByText("9753")).toBeNull();
  });
  it("borra al desmontar/cambiar negocio y al cerrar el diálogo", async () => {
    const vista = montar(<TusPines key="uno" />); await revelar();
    vista.rerender(<QueryClientProvider client={qc}><TusPines key="dos" /></QueryClientProvider>); expect(screen.queryByText("9753")).toBeNull();
    abrir(); escribirAcceso(); fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); abrir(); expect(screen.getByLabelText("PIN de acceso (6 dígitos)", { exact: true })).toHaveValue("");
  });
  it("recuperación prellena únicamente el teléfono", () => {
    montar(); abrir(); escribirAcceso(); fireEvent.click(screen.getByRole("link", { name: "Olvidé mi PIN de acceso" }));
    expect(sessionStorage.getItem("misaldo.telefono-prellenado")).toBe("5512345678"); expect(JSON.stringify(sessionStorage)).not.toContain("582739");
  });
});
describe("P46 cambio de canje", () => {
  function cambiar(confirmacion = "9753") {
    fireEvent.click(screen.getByRole("button", { name: "Cambiar PIN de canje", exact: true })); escribirAcceso();
    fireEvent.change(screen.getByLabelText("PIN de canje nuevo (4 dígitos)", { exact: true }), { target: { value: "9753" } });
    fireEvent.change(screen.getByLabelText("Confirma tu PIN de canje nuevo (4 dígitos)", { exact: true }), { target: { value: confirmacion } });
  }
  it("confirmación distinta impide enviar y coincidencia permite PUT", async () => {
    montar(); cambiar("9752"); const boton = screen.getByRole("button", { name: "Guardar PIN de canje" }); expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirma tu PIN de canje nuevo (4 dígitos)", { exact: true }), { target: { value: "9753" } }); fireEvent.click(boton);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/perfil/codigos", { method: "PUT", body: { pin: "582739", codigo_canje: "9753" } }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("muestra error codigo_trivial sin cambiar el PIN", async () => {
    m.api.mockRejectedValue(new ApiError(422, { codigo: "codigo_trivial" })); montar(); cambiar(); fireEvent.click(screen.getByRole("button", { name: "Guardar PIN de canje" }));
    await screen.findByText("Evita secuencias (1234) o números repetidos (1111)."); expect(screen.getByLabelText("PIN de acceso (6 dígitos)", { exact: true })).toHaveValue("");
  });
});