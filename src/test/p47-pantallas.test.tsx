import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { NotificacionesDispositivo } from "@/components/cuenta/secciones";
import { Route as PromosRoute } from "@/routes/negocio.promociones";
import { Route as ReportesRoute } from "@/routes/negocio.reportes";

const m = vi.hoisted(() => ({
  resumen: vi.fn(), historial: vi.fn(), enviar: vi.fn(), prefs: vi.fn(), guardarPrefs: vi.fn(),
  contar: vi.fn(), descargar: vi.fn(), toastOk: vi.fn(), toastErr: vi.fn(), promoCliente: vi.fn(),
}));
vi.mock("@/lib/api/push", () => ({
  resumenPromociones: m.resumen, historialPromociones: m.historial, enviarPromocion: m.enviar,
  preferenciasPush: m.prefs, guardarPreferenciasPush: m.guardarPrefs,
}));
vi.mock("@/lib/api/marketing", () => ({ contarReporte: m.contar, descargarReporte: m.descargar }));
vi.mock("@/lib/push-dispositivo", () => ({ estadoPush: async () => "activadas", activarPush: vi.fn(), desactivarPush: vi.fn() }));
vi.mock("@/components/cuenta/cuenta-api", async (o) => ({ ...await o<typeof import("@/components/cuenta/cuenta-api")>(), promociones: m.promoCliente }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "dueno", nombre_comercial: "Taquería La Cuna" } } }) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@/components/negocio/beneficio-cumpleanos", () => ({ BeneficioCumpleanos: () => null }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), guardarArchivo: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/negocio/comun", () => ({
  SeccionNegocio: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConConfig: ({ children }: { children: (c: unknown) => ReactNode }) => <>{children({ negocio: { nombre_comercial: "Taquería La Cuna" } })}</>,
}));
vi.mock("sonner", () => ({ toast: { success: m.toastOk, error: m.toastErr, info: vi.fn() } }));

const RESUMEN = { destinatarios: 5, clientes_con_push: 4, totp_activo: true, puede_enviar: true, disponible_desde: null, limite: { por_dia: 1, por_semana: 3 } };
const hoy = (dias = 0) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  m.resumen.mockResolvedValue(RESUMEN);
  m.historial.mockResolvedValue({ promociones: [] });
  m.enviar.mockResolvedValue({ promocion_id: "p1", destinatarios: 5, vigente_hasta: hoy(7) });
  m.promoCliente.mockResolvedValue({ acepta_promociones: true });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); qc.clear(); });
const montar = (ui: ReactNode) => render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
const componente = (r: unknown) => (r as { options: { component: ComponentType } }).options.component;

async function enviarConCodigo() {
  fireEvent.change(await screen.findByLabelText("Título"), { target: { value: "Dos por uno hoy" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Solo hoy en toda la carta." } });
  fireEvent.click(screen.getByRole("button", { name: /Enviar promoción/ }));
  await screen.findByText("Confirma con tu app autenticadora");
  for (const d of ["1", "2", "3", "4", "5", "6"]) fireEvent.click(screen.getByRole("button", { name: d }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

describe("P47 Promociones del dueño", () => {
  it("manda vigente_hasta (hoy + 7 por omisión) con min hoy y max hoy + 60", async () => {
    const P = componente(PromosRoute); montar(<P />);
    const campo = await screen.findByLabelText("Visible para tus clientes hasta");
    expect(campo).toHaveValue(hoy(7));
    expect(campo).toHaveAttribute("min", hoy(0));
    expect(campo).toHaveAttribute("max", hoy(60));
    await enviarConCodigo();
    await waitFor(() => expect(m.enviar).toHaveBeenCalledWith(expect.objectContaining({ vigente_hasta: hoy(7) })));
  });
  it("vigencia_invalida muestra el mensaje en el campo", async () => {
    m.enviar.mockRejectedValue(new ApiError(400, { codigo: "vigencia_invalida" }));
    const P = componente(PromosRoute); montar(<P />);
    await enviarConCodigo();
    expect(await screen.findByText("Elige una fecha entre hoy y dentro de 60 días.")).toBeInTheDocument();
  });
  it("0070: con 0 dispositivos se puede enviar y avisa que se publicó en Inicio", async () => {
    m.resumen.mockResolvedValue({ ...RESUMEN, destinatarios: 0, clientes_con_push: 0 });
    m.enviar.mockResolvedValue({ promocion_id: "p1", destinatarios: 0, vigente_hasta: hoy(7) });
    const P = componente(PromosRoute); montar(<P />);
    await enviarConCodigo();
    expect(screen.getByText(/Ningún cliente tiene las notificaciones activas: la verán en su Inicio/)).toBeInTheDocument();
    await waitFor(() => expect(m.toastOk).toHaveBeenCalledWith("Promoción publicada en el Inicio de tus clientes"));
  });
  it("el historial muestra 'Visible hasta el …' y 'Vencida' cuando ya pasó", async () => {
    const base = { ruta: "/", estado: "enviada", destinatarios: 2, enviados: 2, fallidos: 0, creado_en: "2026-11-01T18:00:00Z", terminada_en: null };
    m.historial.mockResolvedValue({ promociones: [
      { ...base, id: "a", titulo: "Vieja", vigente_hasta: "2026-11-08" },
      { ...base, id: "b", titulo: "Vigente", vigente_hasta: hoy(3) },
    ] });
    const P = componente(PromosRoute); montar(<P />);
    expect(await screen.findByText(/Visible hasta el 8 de noviembre/)).toBeInTheDocument();
    expect(screen.getAllByText("Vencida")).toHaveLength(1);
  });
});

describe("P47 preferencia Beneficio de cumpleaños", () => {
  it("aparece apagado con cumpleanos false y al encenderlo manda { cumpleanos: true }", async () => {
    m.prefs.mockResolvedValue({ movimientos: true, vencimientos: true, cumpleanos: false });
    m.guardarPrefs.mockResolvedValue({ movimientos: true, vencimientos: true, cumpleanos: true });
    montar(<NotificacionesDispositivo />);
    const sw = await screen.findByRole("switch", { name: "Beneficio de cumpleaños" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    await waitFor(() => expect(m.guardarPrefs).toHaveBeenCalledWith({ cumpleanos: true }));
  });
  it("si no acepta promociones de este negocio, lo dice debajo", async () => {
    m.prefs.mockResolvedValue({ movimientos: true, vencimientos: true, cumpleanos: false });
    m.promoCliente.mockResolvedValue({ acepta_promociones: false });
    montar(<NotificacionesDispositivo />);
    expect(await screen.findByText("Para recibirlo de este negocio, activa también Promociones aquí abajo.")).toBeInTheDocument();
  });
});

describe("P47 Excel de cumpleañeros: incluirlos otra vez", () => {
  it("la casilla manda incluir_exportados en el conteo y en la descarga", async () => {
    m.contar.mockResolvedValue({ conteo: 4, tope: 20000, excede_limite: false, omitidos_exportados: 0 });
    m.descargar.mockResolvedValue(new Blob());
    const R = componente(ReportesRoute); montar(<R />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Incluir a los que ya salieron en otro Excel este año" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Contar" })[0]!);
    await waitFor(() => expect(m.contar).toHaveBeenCalledWith("cumpleaneros", expect.objectContaining({ incluir_exportados: true })));
    fireEvent.click(await screen.findByRole("button", { name: "Descargar Excel" }));
    await waitFor(() => expect(m.descargar).toHaveBeenCalledWith("cumpleaneros", expect.objectContaining({ incluir_exportados: true })));
  });
  it("conteo 0 con 3 omitidos: explica por qué y no dice 'No hay clientes'", async () => {
    m.contar.mockResolvedValue({ conteo: 0, tope: 20000, excede_limite: false, omitidos_exportados: 3 });
    const R = componente(ReportesRoute); montar(<R />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Contar" }))[0]!);
    expect(await screen.findByText("3 clientes ya salieron en otro Excel este año. Marca la casilla para incluirlos otra vez.")).toBeInTheDocument();
    expect(screen.queryByText("No hay clientes en ese rango")).toBeNull();
    expect(m.contar).toHaveBeenCalledWith("cumpleaneros", expect.objectContaining({ incluir_exportados: false }));
    await act(async () => {});
  });
});
