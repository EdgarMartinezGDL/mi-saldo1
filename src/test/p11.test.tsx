import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasoFicha, correoCajaValido } from "@/components/caja/paso-ficha";
import { PestanaNotificaciones } from "@/components/staff/notificaciones";
import { ApiError } from "@/lib/api/client";
import type { ClienteCaja } from "@/lib/api/caja";
import type { NotificacionStaff } from "@/lib/api/staff";
import { inicioDiaMx, diaSiguiente } from "@/lib/fechas-staff";

const m = vi.hoisted(() => ({ guardar: vi.fn(), avisar: vi.fn(), ejecutar: vi.fn(), listar: vi.fn(), verFicha: vi.fn(), errorStaff: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/api/caja", async (o) => ({ ...await o<typeof import("@/lib/api/caja")>(), guardarCorreoCliente: m.guardar }));
vi.mock("@/lib/api/staff", async (o) => ({ ...await o<typeof import("@/lib/api/staff")>(), notificaciones: m.listar }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/caja/caja-contexto", async (o) => ({ ...await o<typeof import("@/components/caja/caja-contexto")>(), useCaja: () => ({ moneda: "MXN", ejecutar: m.ejecutar }), avisarError: m.avisar }));
vi.mock("@/components/staff/comun", async (o) => ({ ...await o<typeof import("@/components/staff/comun")>(), errorStaff: m.errorStaff, useStaffNav: () => ({ verFicha: m.verFicha }) }));
vi.mock("@/lib/use-desplazar", () => ({ useDesplazarAlAbrir: () => ({ current: null }) }));

const ficha: ClienteCaja = { cliente: { persona_id: "elena", nombre: "Elena", apellido_paterno: "Demo", cuenta_activada: false, requiere_codigo_acumulacion: false, puede_canjear: false, correo: { estado: "sin_correo", enmascarado: null } } };
const aviso: NotificacionStaff = { notificacion_id: "n1", creado_en: "2026-10-19T01:03:09Z", actualizado_en: "2026-10-19T01:03:10Z", enviado_en: null, evento: "correo_caja_registrado", canal: "correo", estado: "fallido", intentos: 1, ultimo_error: "sin_destino: La persona no tiene correo", remitente: null, destinatario: { persona_id: "elena", nombre: "Elena", apellido_paterno: "Demo", telefono: "+52••••••0005", correo: "e***@ejemplo.mx" }, negocio: null };
Object.assign(aviso, { entrega: "sin_confirmar", entregado_en: null, leido_en: null, entrega_detalle: null,
  reintento_de: null, reintento_num: 0, reintentado_en: null, reintento: { posible: false, motivo: "sin_destino" } });
const resumen = { enviado: 9, fallido: 1, pendiente: 2, reintentando: 3, entrega: { sin_confirmar: 4, entregado: 3, leido: 2, no_entregado: 0, rebotado: 0, queja: 0 } };
const cursor = { antes_de: "2026-10-19T00:16:24Z", antes_id: "n1" };
beforeEach(() => {
  vi.clearAllMocks();
  m.ejecutar.mockImplementation((fn: () => Promise<unknown>) => fn());
  m.guardar.mockResolvedValue({ guardado: true, correo: { estado: "sin_confirmar", enmascarado: "e***@ejemplo.mx" } });
  m.listar.mockResolvedValue({ notificaciones: [aviso], resumen_24h: resumen, siguiente: null });
});
afterEach(cleanup);

function abrir(c = ficha) {
  const refrescar = vi.fn().mockResolvedValue(undefined); const volver = vi.fn();
  render(<PasoFicha ficha={c} onAccion={() => {}} onVolver={volver} onRefrescar={refrescar} />);
  return { refrescar, volver };
}
function llenar() {
  fireEvent.click(screen.getByRole("button", { name: "Agregar correo" }));
  fireEvent.change(screen.getByLabelText("Correo del cliente"), { target: { value: "elena.demo@ejemplo.mx" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar correo" }));
}

describe("P11 correo en ficha de Caja", () => {
  it("un correo confirmado no se revela ni permite corregirlo", () => {
    abrir({ cliente: { ...ficha.cliente, correo: { estado: "confirmado", enmascarado: "secreto@ejemplo.mx" } } });
    expect(screen.queryByRole("button", { name: /correo/ })).toBeNull();
    expect(screen.queryByText(/secreto@/)).toBeNull();
  });
  it("rechaza correo sin @ o sin punto después", () => {
    expect(correoCajaValido("elena.ejemplo.mx")).toBe(false);
    expect(correoCajaValido("elena@ejemplo")).toBe(false);
    expect(correoCajaValido("elena@ejemplo.mx")).toBe(true);
  });
  it("no guarda un correo mal escrito", () => {
    abrir(); fireEvent.click(screen.getByRole("button", { name: "Agregar correo" }));
    fireEvent.change(screen.getByLabelText("Correo del cliente"), { target: { value: "elena@" } });
    expect(screen.getByRole("button", { name: "Guardar correo" })).toBeDisabled(); expect(m.guardar).not.toHaveBeenCalled();
  });
  it.each([true, false])("guardado=%s usa ejecutar, cierra y refresca", async (guardado) => {
    m.guardar.mockResolvedValue({ guardado, correo: { estado: "sin_confirmar", enmascarado: "e***@ejemplo.mx" } });
    const { refrescar } = abrir(); llenar();
    await waitFor(() => expect(refrescar).toHaveBeenCalledOnce());
    expect(m.guardar).toHaveBeenCalledWith("elena", "elena.demo@ejemplo.mx"); expect(m.ejecutar).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Correo del cliente")).toBeNull();
  });
  it("permite corregir el correo sin confirmar sin precargar el enmascarado", () => {
    abrir({ cliente: { ...ficha.cliente, correo: { estado: "sin_confirmar", enmascarado: "e***@ejemplo.mx" } } });
    fireEvent.click(screen.getByRole("button", { name: "Corregir correo" }));
    expect(screen.getByLabelText("Correo del cliente")).toHaveValue("");
  });
  it("404 avisa y vuelve a buscar", async () => {
    const error = new ApiError(404, { codigo: "no_encontrado", message: "El cliente no está registrado en este negocio" }); m.guardar.mockRejectedValue(error);
    const { volver, refrescar } = abrir(); llenar();
    await waitFor(() => expect(volver).toHaveBeenCalledOnce()); expect(m.avisar).toHaveBeenCalledWith(error, "MXN"); expect(refrescar).not.toHaveBeenCalled();
  });
  it("409 avisa sin salir de la ficha", async () => {
    const error = new ApiError(409, { codigo: "correo_confirmado", message: "Solo él puede cambiarlo" }); m.guardar.mockRejectedValue(error);
    const { volver, refrescar } = abrir(); llenar();
    await waitFor(() => expect(m.avisar).toHaveBeenCalledWith(error, "MXN")); expect(volver).not.toHaveBeenCalled(); expect(refrescar).not.toHaveBeenCalled();
  });
});

describe("P11 Notificaciones", () => {
  it("conserva resumen de primera página y usa cursor con los filtros aplicados", async () => {
    m.listar.mockResolvedValueOnce({ notificaciones: [aviso], resumen_24h: resumen, siguiente: cursor })
      .mockResolvedValueOnce({ notificaciones: [{ ...aviso, notificacion_id: "n2" }], resumen_24h: null, siguiente: null });
    render(<PestanaNotificaciones />);
    fireEvent.change(await screen.findByLabelText("Evento"), { target: { value: "no_aplicado" } });
    fireEvent.click(await screen.findByRole("button", { name: "Cargar más" }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith(cursor));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Elena Demo" })).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: /9\s*Enviadas/ }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "enviado", evento: "no_aplicado" }));
  });
  it("tocar Fallidas aplica estado fallido", async () => {
    render(<PestanaNotificaciones />); fireEvent.click(await screen.findByRole("button", { name: /1\s*Fallidas/ }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "fallido" }));
  });
  it("filtros envían evento exacto, canal y fechas ISO con Hasta excluido", async () => {
    render(<PestanaNotificaciones />); await screen.findByRole("button", { name: "Elena Demo" });
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "correo" } });
    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "pin_restablecido" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-18" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-19" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ canal: "correo", evento: "pin_restablecido", desde: "2026-10-18T06:00:00.000Z", hasta: "2026-10-20T06:00:00.000Z" }));
  });
  it("abre la ficha del destinatario", async () => {
    render(<PestanaNotificaciones />); fireEvent.click(await screen.findByRole("button", { name: "Elena Demo" })); expect(m.verFicha).toHaveBeenCalledWith("elena");
  });
  it("envía errores a errorStaff con el mensaje real habilitado", async () => {
    const error = new ApiError(400, { message: ["estado: pendiente, reintentando, enviado o fallido"] }); m.listar.mockRejectedValue(error);
    render(<PestanaNotificaciones />); await waitFor(() => expect(m.errorStaff).toHaveBeenCalledWith(error, {}, true));
  });
  it("Desde y Hasta mantienen la lógica de Auditoría", () => {
    expect(inicioDiaMx("2026-10-19")).toBe("2026-10-19T06:00:00.000Z");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });
});

describe("P11 contratos reales", () => {
  it("correo usa únicamente el PUT y cuerpo suministrados", async () => {
    const original = await vi.importActual<typeof import("@/lib/api/caja")>("@/lib/api/caja");
    await original.guardarCorreoCliente("persona/1", "elena@ejemplo.mx");
    expect(m.api).toHaveBeenCalledWith("/api/clientes/persona%2F1/correo", { method: "PUT", body: { correo: "elena@ejemplo.mx" } });
  });
  it("notificaciones usa GET con límite 50 y filtros opcionales", async () => {
    const original = await vi.importActual<typeof import("@/lib/api/staff")>("@/lib/api/staff");
    await original.notificaciones({ canal: "correo", estado: "fallido" });
    expect(m.api).toHaveBeenCalledWith("/api/staff/notificaciones?limite=50&canal=correo&estado=fallido");
  });
});