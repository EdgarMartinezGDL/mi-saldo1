import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeccionMembresia } from "@/components/membresia";
import { Domiciliado } from "@/components/domiciliado";
import { Route } from "@/routes/membresia.domiciliado";
import { ApiError } from "@/lib/api/client";
import { intervaloSuscripcion, type MetodosMembresia, type SuscripcionMembresia } from "@/lib/api/pagos";

const m = vi.hoisted(() => ({ metodos: vi.fn(), datos: vi.fn(), membresia: vi.fn(), crear: vi.fn(), consultar: vi.fn(), domiciliar: vi.fn(), verificar: vi.fn(), cancelar: vi.fn(), reanudar: vi.fn(), conTotp: vi.fn(), resultado: "ok" }));
vi.mock("@/lib/api/pagos", async (original) => ({ ...await original<typeof import("@/lib/api/pagos")>(),
  metodosMembresia: m.metodos, crearPago: m.crear, consultarSuscripcion: m.consultar, crearSuscripcion: m.domiciliar,
  verificarSuscripcion: m.verificar, cancelarSuscripcion: m.cancelar, reanudarSuscripcion: m.reanudar, pagosMembresia: async () => ({ pagos: [] }),
}));
vi.mock("@/lib/api/operacion", () => ({ datosPago: m.datos }));
vi.mock("@/lib/api/dueno", () => ({ membresia: m.membresia }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "dueno" } } }) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => m.conTotp }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({ resultado: m.resultado }) }),
}));
const metodos: MetodosMembresia = {
  metodos: [
    { clave: "stripe_tarjeta", estado: "activo", nombre: "Tarjeta (pago único)", modalidad: "unico", proveedor: "stripe", disponible: true },
    { clave: "stripe_domiciliado", estado: "activo", nombre: "Tarjeta domiciliada (cada mes)", modalidad: "suscripcion", proveedor: "stripe", disponible: true },
    { clave: "transferencia", estado: "activo", nombre: "Transferencia SPEI", modalidad: "unico", proveedor: "manual", disponible: true },
    { clave: "oxxo_deposito", estado: "activo", nombre: "Depósito en OXXO", modalidad: "unico", proveedor: "manual", disponible: true },
    { clave: "mercadopago", estado: "proximamente", nombre: "Mercado Pago", modalidad: "unico", proveedor: "mercadopago", disponible: false },
  ], precio_mensual_centavos: 29900, moneda: "MXN", stripe_prueba: true, mercadopago_simulado: true,
};
const activa: SuscripcionMembresia = {
  id: "fde0b746-1788-41b8-9ba7-bfa1c46e40eb", proveedor: "stripe", modo: "prueba", prueba: true, estado: "activa",
  precio_mensual_centavos: 29900, moneda: "MXN", primer_cobro: "2026-12-05", cancelar_al_final: false,
  periodo_fin: "2026-12-05T18:00:00+00:00", url_pago: null, tarjeta: { marca: "visa", ultimos4: "4242" },
  expira_en: "2026-10-31T00:19:10.133352+00:00", activada_en: "2026-10-31T00:13:14.913285+00:00", cancelada_en: null, creado_en: "2026-10-30T23:19:10.133352+00:00",
};
const assign = vi.fn();
function montar(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); return client;
}
function regreso() { const Component = Route.options.component; if (Component) montar(<Component />); }
beforeEach(() => {
  vi.clearAllMocks(); m.resultado = "ok";
  vi.stubGlobal("location", { ...window.location, assign });
  m.metodos.mockResolvedValue(metodos); m.consultar.mockResolvedValue({ suscripcion: null, cobros: [] });
  m.datos.mockResolvedValue({ transferencia: { banco: "Banco", clabe: "123" }, oxxo: { tarjeta: "123", titular: "Demo" }, whatsapp: null });
  m.membresia.mockResolvedValue({ estado: "activa", fecha_vencimiento: "2026-12-05", costo_mensual_centavos: 29900 });
  m.crear.mockResolvedValue({ creada: true, pago: { url_pago: "https://checkout.stripe.com/pago" } });
  m.domiciliar.mockResolvedValue({ creada: true, suscripcion: { ...activa, estado: "creada", url_pago: "https://checkout.stripe.com/domiciliado" } });
  m.verificar.mockResolvedValue({ suscripcion: activa, cobros: [] });
  m.cancelar.mockResolvedValue({ cambiado: true, suscripcion: { ...activa, cancelar_al_final: true } });
  m.reanudar.mockResolvedValue({ cambiado: true, suscripcion: activa });
  m.conTotp.mockImplementation((fn: () => Promise<unknown>) => fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("P21 selector y pago único", () => {
  it("respeta el orden y la disponibilidad del servidor", async () => {
    montar(<SeccionMembresia />); await screen.findByRole("button", { name: /Tarjeta \(pago único\)/ });
    const headers = screen.getAllByRole("button").filter((b) => metodos.metodos.some((item) => b.textContent?.includes(item.nombre)));
    expect(headers.map((b) => metodos.metodos.find((item) => b.textContent?.includes(item.nombre))?.clave)).toEqual(["stripe_tarjeta", "stripe_domiciliado", "transferencia", "oxxo_deposito", "mercadopago"]);
    expect(screen.getByRole("button", { name: /Mercado Pago/ })).toBeDisabled();
  });
  it("oculta apagado y deshabilita activo no disponible", async () => {
    m.metodos.mockResolvedValue({ ...metodos, metodos: metodos.metodos.map((item) => ({ ...item, ...(item.clave === "stripe_tarjeta" ? { estado: "apagado" } : item.clave === "stripe_domiciliado" ? { disponible: false } : {}) })) });
    montar(<SeccionMembresia />); expect(await screen.findByRole("button", { name: /Tarjeta domiciliada/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Tarjeta \(pago único\)/ })).toBeNull();
  });
  it("Stripe envía dos meses, tarjeta y proveedor y redirige", async () => {
    montar(<SeccionMembresia />); fireEvent.click(await screen.findByRole("button", { name: /Tarjeta \(pago único\)/ }));
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.change(screen.getByLabelText("Meses"), { target: { value: "2" } });
    expect(screen.getByText("Total: $598.00 MXN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
    await waitFor(() => expect(m.crear).toHaveBeenCalledWith({ proveedor: "stripe", metodo: "tarjeta", meses: 2, idempotency_key: expect.any(String) }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/pago"));
  });
});
describe("P21 domiciliado", () => {
  it("ofrece 299 al mes y un doble toque crea una vez y redirige", async () => {
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    const b = await screen.findByRole("button", { name: "Domiciliar mi tarjeta" });
    expect(screen.getByText(/\$299.00 MXN cada mes/)).toBeInTheDocument();
    fireEvent.click(b); fireEvent.click(b);
    await waitFor(() => expect(m.domiciliar).toHaveBeenCalledTimes(1));
    expect(m.domiciliar).toHaveBeenCalledWith(expect.any(String));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/domiciliado"));
  });
  it("409 ya_suscrito recarga sin error", async () => {
    m.domiciliar.mockRejectedValue(new ApiError(409, { codigo: "ya_suscrito", message: "Ya existe" }));
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    fireEvent.click(await screen.findByRole("button", { name: "Domiciliar mi tarjeta" }));
    await waitFor(() => expect(m.consultar).toHaveBeenCalledTimes(2)); expect(screen.queryByText("Ya existe")).toBeNull();
  });
  it("reintento de creación conserva la llave", async () => {
    m.domiciliar.mockRejectedValue(new ApiError(503, { codigo: "pasarela_no_disponible" }));
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    fireEvent.click(await screen.findByRole("button", { name: "Domiciliar mi tarjeta" }));
    await screen.findByText("La pasarela de pago no responde; intenta de nuevo");
    fireEvent.click(screen.getByRole("button", { name: "Domiciliar mi tarjeta" }));
    await waitFor(() => expect(m.domiciliar).toHaveBeenCalledTimes(2));
    expect(m.domiciliar.mock.calls[1]?.[0]).toBe(m.domiciliar.mock.calls[0]?.[0]);
  });
  it("cancelar confirma y reanudar usa conTotp", async () => {
    m.consultar.mockResolvedValue({ suscripcion: activa, cobros: [] });
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    await screen.findByText("Visa terminación 4242");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar domiciliado" }));
    expect(m.cancelar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    const b = await screen.findByRole("button", { name: "Reanudar domiciliado" });
    expect(m.cancelar).toHaveBeenCalledTimes(1); expect(m.conTotp).toHaveBeenCalledTimes(1);
    fireEvent.click(b); await screen.findByRole("button", { name: "Cancelar domiciliado" });
    expect(m.reanudar).toHaveBeenCalledTimes(1); expect(m.conTotp).toHaveBeenCalledTimes(2);
  });
  it("totp cancelado no muestra error ni modifica estado", async () => {
    m.consultar.mockResolvedValue({ suscripcion: { ...activa, cancelar_al_final: true }, cobros: [] });
    m.conTotp.mockRejectedValue(new ApiError(403, { codigo: "totp_cancelado", message: "Se canceló" }));
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reanudar domiciliado" }));
    await waitFor(() => expect(m.conTotp).toHaveBeenCalled());
    expect(m.reanudar).not.toHaveBeenCalled(); expect(screen.queryByText("Se canceló")).toBeNull();
  });
  it("pago pendiente permite cancelar sin renovar", async () => {
    m.consultar.mockResolvedValue({ suscripcion: { ...activa, estado: "pago_pendiente" }, cobros: [] });
    montar(<Domiciliado precioMensualCentavos={29900} moneda="MXN" />);
    expect(await screen.findByRole("button", { name: "Cancelar domiciliado" })).toBeEnabled();
    expect(screen.getByText(/No pudimos cobrar tu tarjeta/)).toBeInTheDocument();
  });
});
describe("P21 regreso y consulta periódica", () => {
  it("verifica una vez y muestra primer cargo futuro", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-31T04:00:00Z").getTime());
    m.consultar.mockResolvedValue({ suscripcion: activa, cobros: [] }); regreso();
    await screen.findByText("¡Tu tarjeta quedó domiciliada!");
    expect(m.verificar).toHaveBeenCalledTimes(1); expect(m.consultar).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/El primer cargo de \$299.00 MXN será el/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
  it("cancelado no llama ni verificación ni consulta", () => {
    m.resultado = "cancelado"; regreso();
    expect(screen.getByText(/No se guardó tu tarjeta/)).toBeInTheDocument();
    expect(m.verificar).not.toHaveBeenCalled(); expect(m.consultar).not.toHaveBeenCalled();
  });
  it("consulta creada cada tres segundos solo durante un minuto", () => {
    expect(intervaloSuscripcion("creada", 0, 59_999)).toBe(3_000);
    expect(intervaloSuscripcion("creada", 0, 60_000)).toBe(false);
  });
  it.each(["activa", "vencida", "cancelada", "duplicada", "pago_pendiente"] as const)("detiene consulta en %s", (estado) => {
    expect(intervaloSuscripcion(estado, 0, 0)).toBe(false);
  });
});