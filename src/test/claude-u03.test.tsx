import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ultimosAtendidos } from "@/components/caja/atendidos-recientes";
import { PasoBuscar } from "@/components/caja/paso-buscar";

const m = vi.hoisted(() => ({ api: vi.fn(), rol: "empleado" as "empleado" | "dueno" }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/caja/caja-contexto", () => ({ useCaja: () => ({ moneda: "MXN", rol: m.rol, zona: "America/Mexico_City", ejecutar: (fn: () => unknown) => fn() }), avisarError: vi.fn() }));
vi.mock("@/components/qr-registro", () => ({ BotonQrRegistro: () => null, useEnlaceRegistro: () => ({ conRegistro: false }) }));

const mov = (tel: string | null, nombre: string, tipo = "acumulacion", fecha = "2026-11-25T18:00:00Z") => ({ movimiento_id: nombre + fecha, fecha, tipo, modulo: "monedero", cliente: { nombre, apellido_paterno: null, telefono: tel } });
const clients: QueryClient[] = [];
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); m.rol = "empleado";
  const movimientos = [mov("+525500000003", "Juan", "canje", "2026-11-25T19:00:00Z"), mov("+525500000004", "Nora"), mov("+525500000003", "Juan"), mov(null, "Sin teléfono")];
  m.api.mockImplementation(async (path: string, init?: { body?: unknown }) => {
    if (path.startsWith("/api/historial/mi-jornada")) return { jornada: {}, totales: {}, movimientos, siguiente: null };
    if (path === "/api/historial/consulta") return { movimientos: [mov("+525500000009", "Leah")], siguiente: null };
    if (path === "/api/clientes/busqueda") return { encontrado: true, cliente: { persona_id: "p", nombre: "Juan", telefono: (init?.body as { telefono: string }).telefono }, monedero: { saldo_centavos: 0, fecha_vencimiento: null, acumula: true } };
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("U-03 ultimosAtendidos", () => {
  it("uno por teléfono, más reciente primero, solo acumulaciones y canjes, máximo 5", () => {
    const movs = [mov("+525500000001", "A"), mov("+525500000001", "A"), mov("+525500000002", "B", "ajuste_manual"), mov("+525500000003", "C", "canje"), mov(null, "D"),
      mov("+525500000004", "E"), mov("+525500000005", "F"), mov("+525500000006", "G"), mov("+525500000007", "H")];
    expect(ultimosAtendidos(movs).map((a) => a.nombre)).toEqual(["A", "C", "E", "F", "G"]);
    expect(ultimosAtendidos(movs)[0]?.telefono).toBe("5500000001");
  });
});

describe("U-03 Atendidos hace poco en la Caja", () => {
  it("el empleado ve los suyos, con solo los últimos 4 dígitos; un toque abre la ficha", async () => {
    const onEncontrado = vi.fn();
    montar(<PasoBuscar inicial="" onAlta={vi.fn()} onEncontrado={onEncontrado} />);
    // Con la máquina cargada, la consulta tarda más de 1 s (el límite por omisión de findBy).
    const juan = await screen.findByRole("button", { name: /Juan/ }, { timeout: 5000 });
    expect(screen.getAllByRole("button", { name: /Juan|Nora/ })).toHaveLength(2);
    expect(juan).toHaveTextContent("Termina en 0003");
    expect(screen.queryByText(/55 0000 0003/)).toBeNull();
    expect(m.api).not.toHaveBeenCalledWith("/api/historial/consulta", expect.anything());
    fireEvent.click(juan);
    await waitFor(() => expect(onEncontrado).toHaveBeenCalledWith("5500000003", expect.objectContaining({ encontrado: true })));
    expect(m.api).toHaveBeenCalledWith("/api/clientes/busqueda", expect.objectContaining({ body: { telefono: "+525500000003" } }));
  });
  it("el dueño ve los de todo el negocio hoy", async () => {
    m.rol = "dueno";
    montar(<PasoBuscar inicial="" onAlta={vi.fn()} onEncontrado={vi.fn()} />);
    await screen.findByRole("button", { name: /Leah/ });
    expect(m.api).toHaveBeenCalledWith("/api/historial/consulta", expect.objectContaining({ method: "POST" }));
  });
  it("sin nadie atendido no ocupa lugar", async () => {
    m.api.mockImplementation(async () => ({ jornada: {}, totales: {}, movimientos: [], siguiente: null }));
    montar(<PasoBuscar inicial="" onAlta={vi.fn()} onEncontrado={vi.fn()} />);
    await waitFor(() => expect(m.api).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Atendidos hace poco" })).toBeNull();
  });
});
