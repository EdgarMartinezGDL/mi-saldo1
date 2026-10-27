import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeccionMembresia } from "@/components/membresia";

vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "dueno" } } }) }));
vi.mock("@/lib/api/operacion", () => ({ datosPago: vi.fn() }));
vi.mock("@/lib/api/dueno", () => ({ membresia: vi.fn() }));
vi.mock("@/lib/api/pagos", async (original) => ({ ...await original<typeof import("@/lib/api/pagos")>(), pagosMembresia: async () => ({ pagos: [] }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
function montar(disponible: boolean, precio: number | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["membresia-pago"], { transferencia: { banco: "Banco", cuenta: "Cuenta" }, oxxo: null, pasarela: { disponible, precio_mensual_centavos: precio, moneda: "MXN", metodos: ["tarjeta"], meses_maximos: 12, simulado: true } });
  render(<QueryClientProvider client={qc}><SeccionMembresia /></QueryClientProvider>);
}
afterEach(cleanup);
describe("P13 precio del dueño", () => {
  it("sin precio no ofrece pago en línea", () => {
    montar(false, null);
    expect(screen.queryByRole("button", { name: /Pago en línea/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Transferencia/ })).toBeEnabled();
  });
  it("precio nuevo del servidor se usa para el total", () => {
    montar(true, 34900);
    fireEvent.click(screen.getByRole("button", { name: /Pago en línea/ }));
    expect(screen.getByText("Total: $349.00 MXN")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Meses"), { target: { value: "2" } });
    expect(screen.getByText("Total: $698.00 MXN")).toBeInTheDocument();
  });
});