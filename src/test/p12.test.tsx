import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasoAlta } from "@/components/caja/paso-alta";
import { AvisoPrivacidad } from "@/components/enlace-ui";
import { AvisoPendiente } from "@/components/aviso-pendiente";
import { PagoEnLinea } from "@/components/pago-en-linea";
import { ApiError } from "@/lib/api/client";

const m = vi.hoisted(() => ({ alta: vi.fn(), aviso: vi.fn(), aceptar: vi.fn(), perfil: vi.fn(), crear: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/caja/caja-extra", () => ({ altaCliente: m.alta, configReferidos: async () => ({ activo: false }) }));
vi.mock("@/components/caja/caja-contexto", () => ({ useCaja: () => ({ ejecutar: (f: () => Promise<unknown>) => f() }), EncabezadoPaso: () => null, avisarError: vi.fn() }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: "dueno" } } }) }));
vi.mock("@/lib/api/cliente", () => ({ perfil: m.perfil, aceptarAviso: m.aceptar }));
vi.mock("@/lib/api/privacidad", async (original) => ({ ...await original<typeof import("@/lib/api/privacidad")>(), avisoQuery: () => ({ queryKey: ["aviso-privacidad"], queryFn: m.aviso, staleTime: 300000, retry: false }) }));
vi.mock("@/lib/api/pagos", async (original) => ({ ...await original<typeof import("@/lib/api/pagos")>(), crearPago: m.crear }));
const aviso = { version: "provisional-2026-10", resumen: "Resumen de prueba" };
function montar(ui: React.ReactNode, cargarAviso = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (cargarAviso) client.setQueryData(["aviso-privacidad"], aviso);
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); return client;
}
beforeEach(() => { vi.clearAllMocks(); m.aviso.mockResolvedValue(aviso); m.alta.mockResolvedValue({ pendiente: false }); m.crear.mockRejectedValue(new ApiError(503, { codigo: "pasarela_no_disponible" })); });
afterEach(cleanup);
describe("P12 consentimiento", () => {
  it("impide aceptar antes de cargar el aviso", () => {
    m.aviso.mockReturnValue(new Promise(() => {})); montar(<AvisoPrivacidad valor={false} onChange={() => {}} />, false);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
  it("impide aceptar si el aviso falla", async () => {
    m.aviso.mockRejectedValue(new Error("red")); montar(<AvisoPrivacidad valor={false} onChange={() => {}} />, false);
    await waitFor(() => expect(m.aviso).toHaveBeenCalled()); expect(screen.getByRole("checkbox")).toBeDisabled();
  });
  it("alta envía la versión cargada", async () => {
    montar(<PasoAlta telefono="5512345678" onVolver={() => {}} onHecha={() => {}} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Luis" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "luis@ejemplo.mx" } });
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
    await waitFor(() => expect(m.alta).toHaveBeenCalledWith(expect.objectContaining({ version_aviso: "provisional-2026-10", acepta_aviso_privacidad: true })));
  });
  it("409 desmarca y recarga sin borrar nombre ni correo", async () => {
    m.alta.mockRejectedValue(new ApiError(409, { codigo: "aviso_desactualizado", message: "Cambió el aviso" }));
    montar(<PasoAlta telefono="5512345678" onVolver={() => {}} onHecha={() => {}} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Luis" } }); fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "luis@ejemplo.mx" } });
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
    await waitFor(() => expect(m.aviso).toHaveBeenCalled());
    expect(screen.getByRole("checkbox")).not.toBeChecked(); expect(screen.getByLabelText("Nombre")).toHaveValue("Luis"); expect(screen.getByLabelText("Correo electrónico")).toHaveValue("luis@ejemplo.mx");
  });
  it.each([true, false])("aceptado=%s cierra el pendiente y actualiza perfil", async (aceptado) => {
    m.perfil.mockResolvedValue({ aviso_privacidad: { requiere_aceptar: true } }); m.aceptar.mockImplementation(async () => { m.perfil.mockResolvedValue({ aviso_privacidad: { requiere_aceptar: false } }); return { aceptado }; });
    montar(<AvisoPendiente />); const checkbox = await screen.findByRole("checkbox");
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" }); expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(checkbox); fireEvent.click(screen.getByRole("button", { name: "Aceptar y continuar" }));
    await waitFor(() => expect(m.aceptar).toHaveBeenCalledWith("provisional-2026-10", expect.anything()));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
describe("P12 llave de pago", () => {
  const pasarela = { disponible: true, simulado: true, metodos: ["tarjeta", "oxxo"] as ("tarjeta" | "oxxo")[], precio_mensual_centavos: 29900, moneda: "MXN", meses_maximos: 12 };
  it("reintentos conservan llave; cambiar meses genera otra", async () => {
    montar(<PagoEnLinea pasarela={pasarela} />);
    fireEvent.change(screen.getByLabelText("Meses"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
    await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(1)); await screen.findByRole("button", { name: "Continuar al pago" });
    const primera = m.crear.mock.calls[0]?.[0]; expect(primera.meses).toBe(3); expect(29900 * primera.meses).toBe(89700);
    fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" })); await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(2));
    expect(m.crear.mock.calls[1]?.[0].idempotency_key).toBe(primera.idempotency_key);
    await screen.findByRole("button", { name: "Continuar al pago" }); fireEvent.change(screen.getByLabelText("Meses"), { target: { value: "1" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
    await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(3)); expect(m.crear.mock.calls[2]?.[0].idempotency_key).not.toBe(primera.idempotency_key);
  });
  it("cambiar método genera otra llave", async () => {
    montar(<PagoEnLinea pasarela={pasarela} />); fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" })); await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: "Continuar al pago" }); fireEvent.click(screen.getByRole("radio", { name: "Efectivo en OXXO" })); fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
    await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(2)); expect(m.crear.mock.calls[1]?.[0].metodo).toBe("oxxo"); expect(m.crear.mock.calls[1]?.[0].idempotency_key).not.toBe(m.crear.mock.calls[0]?.[0].idempotency_key);
  });
  it("doble toque durante petición crea una sola orden", async () => {
    m.crear.mockReturnValue(new Promise(() => {})); montar(<PagoEnLinea pasarela={pasarela} />); const b = screen.getByRole("button", { name: "Continuar al pago" }); fireEvent.click(b); fireEvent.click(b);
    await waitFor(() => expect(m.crear).toHaveBeenCalledTimes(1));
  });
});