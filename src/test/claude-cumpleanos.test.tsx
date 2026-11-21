// Claude (2026-11-20): beneficio de cumpleaños — franja de Caja y configuración del dueño (backend 0061).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { FranjaCumpleanos } from "@/components/caja/franja-cumpleanos";
import { BeneficioCumpleanos } from "@/components/negocio/beneficio-cumpleanos";
import { CumpleanosCliente } from "@/components/negocio/cumpleanos-cliente";
import type { CumpleanosCaja } from "@/lib/api/cumpleanos";

const m = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), info: vi.fn(), rol: "empleado", refrescar: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: m.rol, nombre_comercial: "Tortas Leah" } } }) }));
vi.mock("sonner", () => ({ toast: { success: m.toast, error: m.toast, info: m.info } }));
vi.mock("@/components/caja/caja-contexto", async (original) => ({
  ...await original<typeof import("@/components/caja/caja-contexto")>(),
  useCaja: () => ({ ejecutar: (fn: () => unknown) => fn(), moneda: "MXN" }),
  avisarError: m.toast,
}));

const clients: QueryClient[] = [];
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
const base = { negocio_cliente_id: "nc-1", cumpleanos_dia: 14, cumpleanos_mes: 3 };
const disponible: CumpleanosCaja = { ...base, estado: "disponible", beneficio: "Un café gratis", vigencia: "semana" };
const entregado: CumpleanosCaja = { ...base, estado: "entregado", beneficio: "Un café gratis", entrega_id: "e-1", entregado_en: "2026-11-20T16:32:00Z", entregado_por: "Luis", anulable_hoy: true };
const franja = (c: CumpleanosCaja) => montar(<FranjaCumpleanos cumple={c} nombre="Nora" onRefrescar={m.refrescar} />);

beforeEach(() => { vi.resetAllMocks(); m.rol = "empleado"; m.refrescar.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("Caja: franja de cumpleaños", () => {
  it("disponible: entrega solo después de confirmar y refresca la ficha", async () => {
    m.api.mockResolvedValue({ entrega_id: "e-1", beneficio: "Un café gratis" });
    franja(disponible);
    expect(screen.getByText("Cumpleaños de Nora (14 de marzo)")).toBeInTheDocument();
    expect(screen.getByText("Un café gratis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entregar beneficio de cumpleaños" }));
    expect(m.api).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /Sí, entregar/ }));
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/cumpleanos/entregas", { method: "POST", body: { negocio_cliente_id: "nc-1" } }));
    await waitFor(() => expect(m.refrescar).toHaveBeenCalled());
    expect(m.toast).toHaveBeenCalledWith("Listo: Un café gratis");
  });

  it("si otro cajero ya lo entregó (409), avisa y refresca", async () => {
    m.api.mockRejectedValue(new ApiError(409, { codigo: "ya_entregado", message: "Este cliente ya recibió su beneficio de cumpleaños este año" }));
    franja(disponible);
    fireEvent.click(screen.getByRole("button", { name: "Entregar beneficio de cumpleaños" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sí, entregar/ }));
    await waitFor(() => expect(m.info).toHaveBeenCalled());
    expect(m.refrescar).toHaveBeenCalled();
  });

  it("entregado: el cajero ve quién y a qué hora, sin botón de anular", () => {
    franja(entregado);
    expect(screen.getByText(/Ya recibió su beneficio de cumpleaños hoy a las .* \(Luis\): Un café gratis\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entregar beneficio de cumpleaños" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular: no se entregó" })).not.toBeInTheDocument();
  });

  it("entregado: el dueño puede anular el mismo día con motivo", async () => {
    m.rol = "dueno"; m.api.mockResolvedValue({ anulada: true });
    franja(entregado);
    fireEvent.click(screen.getByRole("button", { name: "Anular: no se entregó" }));
    const anular = await screen.findByRole("button", { name: "Anular entrega" });
    expect(anular).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Se tocó por error" } });
    fireEvent.click(anular);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/cumpleanos/entregas/e-1/anulacion", { method: "POST", body: { motivo: "Se tocó por error" } }));
    await waitFor(() => expect(m.refrescar).toHaveBeenCalled());
  });

  it("no disponible: solo un aviso, sin botones", () => {
    franja({ ...base, estado: "no_disponible" });
    expect(screen.getByText("Su beneficio de cumpleaños ya no está disponible este año.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Promociones: configuración del beneficio de cumpleaños", () => {
  it("carga, cambia y guarda con el cuerpo exacto", async () => {
    m.api.mockImplementation(async (path: string, opts?: { method?: string; body?: unknown }) =>
      opts?.method === "PUT" ? { ...(opts.body as object), version: 1 } : { activo: false, beneficio: null, vigencia: "semana", version: 0 });
    montar(<BeneficioCumpleanos />);
    fireEvent.click(await screen.findByRole("switch", { name: "Ofrecer beneficio de cumpleaños" }));
    fireEvent.change(screen.getByLabelText("¿Qué le das?"), { target: { value: "  Un café gratis " } });
    fireEvent.click(screen.getByRole("button", { name: /Todo el mes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/cumpleanos/configuracion", { method: "PUT", body: { activo: true, beneficio: "Un café gratis", vigencia: "mes" } }));
    expect(m.toast).toHaveBeenCalledWith("Listo: la Caja ya ofrece el beneficio de cumpleaños");
  });

  it("sin beneficio escrito no guarda y lo explica", async () => {
    m.api.mockResolvedValue({ activo: false, beneficio: null, vigencia: "semana", version: 0 });
    montar(<BeneficioCumpleanos />);
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el beneficio");
    expect(m.api).toHaveBeenCalledTimes(1); // solo la lectura
  });
});

describe("Ficha del dueño: cambiar cumpleaños (oculto hasta el aviso al cliente)", () => {
  it("apagado: muestra la fecha pero no el botón", async () => {
    m.api.mockResolvedValue({ dia: 14, mes: 3, propia: false, cambio_disponible: false });
    montar(<CumpleanosCliente negocioClienteId="nc-1" />);
    expect(await screen.findByText("Cumpleaños: 14 de marzo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar cumpleaños" })).not.toBeInTheDocument();
  });

  it("encendido: cambia la fecha (31 de abril no se puede) y respeta el mensaje genérico", async () => {
    m.api.mockImplementation(async (_path: string, opts?: { method?: string }) => {
      if (opts?.method === "PUT") throw new ApiError(409, { codigo: "cambio_no_permitido", message: "La fecha de este cliente ya no se puede cambiar este año" });
      return { dia: 14, mes: 3, propia: true, cambio_disponible: true };
    });
    montar(<CumpleanosCliente negocioClienteId="nc-1" />);
    expect(await screen.findByText("Cumpleaños: 14 de marzo (corregido en tu negocio)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar cumpleaños" }));
    fireEvent.change(await screen.findByLabelText("Día"), { target: { value: "31" } });
    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "4" } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Día"), { target: { value: "29" } });
    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/cumpleanos/clientes/nc-1/fecha", { method: "PUT", body: { dia: 29, mes: 2 } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La fecha de este cliente ya no se puede cambiar este año");
  });
});
