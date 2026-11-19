import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Movimiento } from "@/lib/api/cliente";
import { Route } from "@/routes/historial";
import { FilaMovimiento } from "@/components/negocio/operacion-ui";

const m = vi.hoisted(() => ({ movimientos: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/api/cliente", () => ({ movimientos: m.movimientos }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ conectado: true, sesion: { contexto: { rol: "cliente", negocio_id: "negocio" } } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => <p>Cargando…</p> }));
vi.mock("@/lib/use-recarga-visible", () => ({ useRecargaVisible: () => {} }));

const base: Movimiento = { movimiento_id: "uno", fecha: "2026-11-18T05:00:00Z", modulo: "tarjetas_sellos", tipo: "vencimiento", cantidad: -2, tarjeta: "Café" };
type Campos = { [K in keyof Movimiento]?: Movimiento[K] | undefined };
function movimiento(campos: Campos): Movimiento {
  const resultado: Campos = { ...base, ...campos };
  return Object.fromEntries(Object.entries(resultado).filter(([, valor]) => valor !== undefined)) as unknown as Movimiento;
}
const Pagina = (Route as unknown as { options: { component: ComponentType } }).options.component;
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("P37 historial del cliente", () => {
  it.each([
    [{ cantidad: -2, remanente_centavos: 1250 }, "Venció tu tarjeta Café: 2 sellos y $12.50 hacia el siguiente"],
    [{ cantidad: -1, remanente_centavos: 0 }, "Venció tu tarjeta Café: 1 sello"],
    [{ cantidad: 0, remanente_centavos: 1250 }, "Venció tu tarjeta Café: $12.50 hacia el siguiente sello"],
    [{ cantidad: 0, remanente_centavos: 0 }, "Venció tu tarjeta Café"],
    [{ tarjeta: undefined }, "Venció tu tarjeta: 2 sellos"],
    [{ remanente_centavos: undefined }, "Venció tu tarjeta Café: 2 sellos"],
    [{ modulo: "monedero", tipo: "expiracion", monto_centavos: -1250 }, "Venció tu saldo: $12.50"],
    [{ modulo: "monedero", tipo: "expiracion", monto_centavos: undefined }, "Venció tu saldo"],
    [{ modulo: "monedero", tipo: "expiracion", monto_centavos: 0 }, "Venció tu saldo: $0.00"],
  ] satisfies [Campos, string][])("presenta el vencimiento %#", async (campos, esperado) => {
    m.movimientos.mockResolvedValue({ movimientos: [movimiento(campos)], siguiente: null });
    render(<Pagina />);
    expect(await screen.findByText(esperado)).toBeInTheDocument();
    if (movimiento(campos).tipo !== "expiracion") expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });
});

describe("P37 movimientos del dueño y reclamaciones", () => {
  it.each([
    [{ cantidad: -2, remanente_centavos: 1250 }, "Venció 2 sellos y $12.50 de avance en Café", "−2"],
    [{ cantidad: -1, remanente_centavos: 1250 }, "Venció 1 sello y $12.50 de avance en Café", "−1"],
    [{ cantidad: -1, remanente_centavos: 0 }, "Venció 1 sello en Café", "−1"],
    [{ cantidad: 0, remanente_centavos: 1250 }, "Venció $12.50 de avance en Café", "0"],
    [{ cantidad: 0, remanente_centavos: 0 }, "Venció una tarjeta en Café", "0"],
    [{ remanente_centavos: undefined }, "Venció 2 sellos en Café", "−2"],
    [{ tarjeta: undefined }, "Venció 2 sellos", "−2"],
    [{ modulo: "monedero", tipo: "expiracion", monto_centavos: -1250 }, "Venció $12.50", "−$12.50"],
  ] satisfies [Campos, string, string][])("conserva título y número %#", (campos, esperado, valor) => {
    render(<ul><FilaMovimiento m={{ ...movimiento(campos), jornada: "2026-11-17" }} /></ul>);
    expect(screen.getByText(esperado)).toBeInTheDocument();
    expect(screen.getByText(valor)).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });
});