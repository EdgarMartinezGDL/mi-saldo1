// Claude (2026-11-28, backend 0078: C-01 y D-1): el servidor ya no entrega el PIN de canje
// si está bloqueado o en espera de 24 h; la pantalla lo explica sin mostrar nada.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TusPines } from "@/components/cuenta/tus-pines";

const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));

const base = { codigo_canje: null, disponible_desde: null, codigo_canje_bloqueado_hasta: null, codigo_canje_requiere_cambio: false };
let qc: QueryClient;
beforeEach(() => { vi.clearAllMocks(); qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); });
afterEach(() => { cleanup(); qc.clear(); });

async function consultar(respuesta: object) {
  m.api.mockResolvedValue({ ...base, ...respuesta });
  render(<QueryClientProvider client={qc}><TusPines telefono="+525512345678" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de canje" }));
  fireEvent.change(screen.getByLabelText("PIN de acceso (6 dígitos)", { exact: true }), { target: { value: "582739" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver mi PIN de canje" }));
  await act(async () => {});
}

describe("PIN de canje con candados (0078)", () => {
  it("en espera: explica desde cuándo podrá verlo, que sigue sirviendo en caja y no abre el aviso de 'sin copia'", async () => {
    await consultar({ estado: "en_espera", disponible_desde: "2026-11-29T18:30:00Z" });
    const texto = screen.getByText(/podrás ver tu PIN de canje a partir del/);
    expect(texto).toHaveTextContent("29 de noviembre");
    expect(texto).toHaveTextContent("sigue sirviendo en caja");
    expect(screen.getAllByText("••••")).toHaveLength(2);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("bloqueado por intentos: muestra la hora del bloqueo y no el PIN", async () => {
    await consultar({ estado: "bloqueado", codigo_canje_bloqueado_hasta: "2026-11-28T20:15:00Z" });
    expect(screen.getByText(/Tu PIN de canje está bloqueado hasta las/)).toBeInTheDocument();
    expect(screen.getAllByText("••••")).toHaveLength(2);
  });

  it("con cambio obligatorio: pide cambiarlo sin repetir la hora del bloqueo", async () => {
    await consultar({ estado: "bloqueado", codigo_canje_requiere_cambio: true, codigo_canje_bloqueado_hasta: "2026-11-28T20:15:00Z" });
    expect(screen.getByText(/Cámbialo para volver a usarlo/)).toBeInTheDocument();
    expect(screen.queryByText(/bloqueado hasta las/)).toBeNull();
  });

  it("un bloqueo ya vencido no se muestra cuando el PIN está disponible", async () => {
    await consultar({ estado: "disponible", codigo_canje: "9753", codigo_canje_bloqueado_hasta: "2026-11-01T10:00:00Z" });
    expect(screen.getByText("9753")).toBeInTheDocument();
    expect(screen.queryByText(/bloqueado hasta las/)).toBeNull();
  });
});
