import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTIVOS_NO_REINTENTO, PestanaNotificaciones } from "@/components/staff/notificaciones";
import { ApiError } from "@/lib/api/client";
import type { CadenaNotificacion, NotificacionStaff, RespuestaNotificaciones } from "@/lib/api/staff";

const m = vi.hoisted(() => ({ listar: vi.fn(), reintentar: vi.fn(), cadena: vi.fn(), errorStaff: vi.fn(), verFicha: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/api/staff", async (o) => ({ ...await o<typeof import("@/lib/api/staff")>(), notificaciones: m.listar, reintentarNotificacion: m.reintentar, cadenaNotificacion: m.cadena }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/staff/comun", async (o) => ({ ...await o<typeof import("@/components/staff/comun")>(), errorStaff: m.errorStaff, useStaffNav: () => ({ verFicha: m.verFicha }) }));

const respuesta: RespuestaNotificaciones = {"siguiente": {"antes_de": "2026-10-22T04:17:51.040988+00:00", "antes_id": "e3a7465b-8441-4b33-a609-9be790b74ba8"}, "resumen_24h": {"enviado": 0, "fallido": 2, "pendiente": 0, "reintentando": 0, "entrega": {"sin_confirmar": 0, "entregado": 0, "leido": 0, "no_entregado": 0, "rebotado": 0, "queja": 0}}, "notificaciones": [{"notificacion_id": "44d5cfa5-7b32-42bd-94b4-e6214e9c6f8e", "creado_en": "2026-10-29T01:15:44.935883+00:00", "actualizado_en": "2026-10-29T01:16:44.935883+00:00", "enviado_en": null, "evento": "codigo_verificacion", "canal": "whatsapp", "estado": "fallido", "intentos": 3, "ultimo_error": "Fallo simulado del proveedor (whatsapp)", "remitente": null, "entrega": "sin_confirmar", "entregado_en": null, "leido_en": null, "entrega_detalle": null, "reintento_de": null, "reintento_num": 0, "reintentado_en": null, "reintento": {"posible": false, "motivo": "evento_no_reintentable"}, "destinatario": {"persona_id": "00000000-0000-4000-8000-00000000d004", "nombre": "Diego", "apellido_paterno": "Demo", "telefono": "+52••••••0004", "correo": "d***@ejemplo.mx"}, "negocio": {"negocio_id": "10000000-0000-4000-8000-00000000d102", "nombre_comercial": "Barbería Demo"}}, {"notificacion_id": "e47976dc-f3c3-4239-a947-eb25f90e97ef", "creado_en": "2026-10-29T01:05:44.935883+00:00", "actualizado_en": "2026-10-29T01:06:44.935883+00:00", "enviado_en": null, "evento": "compra_monedero", "canal": "whatsapp", "estado": "fallido", "intentos": 3, "ultimo_error": "Fallo simulado del proveedor (whatsapp)", "remitente": null, "entrega": "sin_confirmar", "entregado_en": null, "leido_en": null, "entrega_detalle": null, "reintento_de": null, "reintento_num": 0, "reintentado_en": null, "reintento": {"posible": true, "motivo": null}, "destinatario": {"persona_id": "00000000-0000-4000-8000-00000000d004", "nombre": "Diego", "apellido_paterno": "Demo", "telefono": "+52••••••0004", "correo": "d***@ejemplo.mx"}, "negocio": {"negocio_id": "10000000-0000-4000-8000-00000000d102", "nombre_comercial": "Barbería Demo"}}, {"notificacion_id": "e3a7465b-8441-4b33-a609-9be790b74ba8", "creado_en": "2026-10-22T04:17:51.040988+00:00", "actualizado_en": "2026-10-22T04:17:51.868851+00:00", "enviado_en": "2026-10-22T04:17:51.868851+00:00", "evento": "compra_monedero", "canal": "correo", "estado": "enviado", "intentos": 1, "ultimo_error": null, "remitente": "no-responder@si-saldo.com", "entrega": "sin_confirmar", "entregado_en": null, "leido_en": null, "entrega_detalle": null, "reintento_de": null, "reintento_num": 0, "reintentado_en": null, "reintento": {"posible": false, "motivo": "no_fallida"}, "destinatario": {"persona_id": "00000000-0000-4000-8000-00000000d004", "nombre": "Diego", "apellido_paterno": "Demo", "telefono": "+52••••••0004", "correo": "d***@ejemplo.mx"}, "negocio": {"negocio_id": "10000000-0000-4000-8000-00000000d101", "nombre_comercial": "Farmacia Demo"}}]};
const cadena: CadenaNotificacion = {"original_id": "e47976dc-f3c3-4239-a947-eb25f90e97ef", "avisos": [{"notificacion_id": "e47976dc-f3c3-4239-a947-eb25f90e97ef", "reintento_num": 0, "creado_en": "2026-10-29T01:05:44.935883+00:00", "enviado_en": null, "evento": "compra_monedero", "canal": "whatsapp", "estado": "fallido", "intentos": 3, "ultimo_error": "Fallo simulado del proveedor (whatsapp)", "entrega": "sin_confirmar", "reintentado_en": "2026-10-29T01:25:44.935883+00:00", "reintento": {"posible": false, "motivo": "ya_reintentada"}}, {"notificacion_id": "5cfde624-979d-4696-ad1a-0af79ad62dd5", "reintento_num": 1, "creado_en": "2026-10-29T01:25:44.935883+00:00", "enviado_en": null, "evento": "compra_monedero", "canal": "whatsapp", "estado": "pendiente", "intentos": 0, "ultimo_error": null, "entrega": "sin_confirmar", "reintentado_en": null, "reintento": {"posible": false, "motivo": "no_fallida"}}]};
const compra = respuesta.notificaciones.find((n) => n.evento === "compra_monedero" && n.estado === "fallido");
const codigo = respuesta.notificaciones.find((n) => n.evento === "codigo_verificacion");
const enviado = respuesta.notificaciones.find((n) => n.estado === "enviado");
if (!compra || !codigo || !enviado) throw new Error("Faltan los avisos reales de P20");
const fallido: NotificacionStaff = compra;
const sensible: NotificacionStaff = codigo;
const enviadoReal: NotificacionStaff = enviado;
const creado = {"notificacion_id": "5cfde624-979d-4696-ad1a-0af79ad62dd5", "reintento_de": "e47976dc-f3c3-4239-a947-eb25f90e97ef", "reintento_num": 1, "evento": "compra_monedero", "canal": "whatsapp"};
const motivo = "Diego dice que no le llegó el aviso de su compra";
beforeEach(() => {
  vi.resetAllMocks();
  m.listar.mockResolvedValue({ ...respuesta, notificaciones: [fallido], siguiente: null });
  m.reintentar.mockResolvedValue(creado);
  m.cadena.mockResolvedValue(cadena);
});
afterEach(cleanup);
async function abrir(avisos: NotificacionStaff[] = [fallido]) {
  m.listar.mockResolvedValue({ ...respuesta, notificaciones: avisos, siguiente: null });
  render(<PestanaNotificaciones />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Diego Demo" })).toHaveLength(avisos.length));
}
async function confirmar() {
  fireEvent.click(screen.getByRole("button", { name: "Reintentar", exact: true }));
  fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: motivo } });
  fireEvent.click(screen.getByRole("button", { name: "Sí, reintentar" }));
}
describe("P20 reintentos", () => {
  it("requiere 5 caracteres y reintenta con el id y filtros aplicados", async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "whatsapp" } });
    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "compra_monedero" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ canal: "whatsapp", evento: "compra_monedero" }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar", exact: true }));
    await screen.findByRole("heading", { name: "¿Reintentar este aviso?" });
    const boton = screen.getByRole("button", { name: "Sí, reintentar" });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "abcd" } });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "abcde" } });
    expect(boton).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: motivo } });
    const antes = m.listar.mock.calls.length;
    fireEvent.click(boton);
    await waitFor(() => expect(m.reintentar).toHaveBeenCalledWith("e47976dc-f3c3-4239-a947-eb25f90e97ef", motivo));
    await waitFor(() => expect(m.listar).toHaveBeenCalledTimes(antes + 1));
    expect(m.listar).toHaveBeenLastCalledWith({ canal: "whatsapp", evento: "compra_monedero" });
  });
  it("no reintenta un código ni muestra motivos en enviados", async () => {
    await abrir([sensible, enviadoReal]);
    expect(screen.queryByRole("button", { name: "Reintentar", exact: true })).toBeNull();
    expect(screen.getByText(MOTIVOS_NO_REINTENTO.evento_no_reintentable)).toBeVisible();
    expect(screen.queryByText(MOTIVOS_NO_REINTENTO.no_fallida)).toBeNull();
    expect(m.reintentar).not.toHaveBeenCalled();
  });
  it("obedece posible del servidor aunque el evento y las fechas parezcan reintentables", async () => {
    await abrir([{ ...fallido, reintento: { posible: false, motivo: "limite_reintentos" } }]);
    expect(screen.queryByRole("button", { name: "Reintentar", exact: true })).toBeNull();
    expect(m.reintentar).not.toHaveBeenCalled();
  });
  it("409 avisa y recarga los filtros aplicados", async () => {
    const error = new ApiError(409, { codigo: "ya_reintentada", message: "Ese aviso ya se reintentó: revisa el más reciente de la cadena" });
    m.reintentar.mockRejectedValue(error);
    await abrir(); await confirmar();
    await waitFor(() => expect(m.errorStaff).toHaveBeenCalledWith(error));
    await waitFor(() => expect(m.listar).toHaveBeenCalledTimes(2));
    expect(m.listar).toHaveBeenLastCalledWith({});
  });
  it("abre la cadena desde un reintento, la cierra y la borra al recargar", async () => {
    await abrir([{ ...fallido, ...creado }]);
    expect(screen.getByText("Reintento 1 de 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver reintentos" }));
    await screen.findByText("Reintento 1 · este aviso");
    expect(screen.getByText("Original")).toBeVisible();
    expect(m.cadena).toHaveBeenCalledWith("5cfde624-979d-4696-ad1a-0af79ad62dd5");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar reintentos" }));
    expect(screen.queryByText("Original")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver reintentos" }));
    await screen.findByText("Original");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(screen.queryByText("Original")).toBeNull());
  });
  it("avisa al fallar la cadena y permite volver a abrir", async () => {
    const error = new ApiError(404, { codigo: "no_encontrada" }); m.cadena.mockRejectedValue(error);
    await abrir([{ ...fallido, ...creado }]);
    fireEvent.click(screen.getByRole("button", { name: "Ver reintentos" }));
    await waitFor(() => expect(m.errorStaff).toHaveBeenCalledWith(error));
    expect(screen.getByRole("button", { name: "Ver reintentos" })).toBeEnabled();
  });
});
describe("P20 entrega y filtros", () => {
  it.each([
    ["leido", null, "Leído", null],
    ["rebotado", { tipo: "rebotado", rebote_tipo: "Permanent", estado_smtp: "5.1.1" }, "Rebotó", "Permanent · 5.1.1"],
  ] as const)("etiqueta y detalle de %s en enviados", async (entrega, detalle, etiqueta, texto) => {
    await abrir([{ ...enviadoReal, entrega, entrega_detalle: detalle }]);
    const fila = screen.getByRole("button", { name: "Diego Demo" }).closest("li");
    if (!fila) throw new Error("Falta la fila");
    expect(within(fila).getByText(etiqueta)).toBeVisible();
    if (texto) expect(within(fila).getByText(texto)).toBeVisible();
  });
  it("no agrega etiqueta de entrega a fallidos", async () => {
    await abrir([{ ...fallido, entrega: "leido" }]);
    const fila = screen.getByRole("button", { name: "Diego Demo" }).closest("li");
    if (!fila) throw new Error("Falta la fila");
    expect(within(fila).queryByText("Leído")).toBeNull();
  });
  it("Entrega fuerza enviado; la tarjeta Fallidas elimina entrega", async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText("Entrega"), { target: { value: "rebotado" } });
    expect(screen.getByLabelText("Estado")).toBeDisabled();
    expect(screen.getByLabelText("Estado")).toHaveValue("enviado");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "enviado", entrega: "rebotado" }));
    fireEvent.click(screen.getByRole("button", { name: /0\s*Leído/ }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "enviado", entrega: "leido" }));
    fireEvent.click(screen.getByRole("button", { name: /2\s*Fallidas/ }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "fallido" }));
    expect(screen.getByLabelText("Entrega")).toHaveValue("");
    expect(screen.getByLabelText("Estado")).toBeEnabled();
  });
  it("borrar Entrega conserva el estado elegido y omite la llave", async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "fallido" } });
    fireEvent.change(screen.getByLabelText("Entrega"), { target: { value: "rebotado" } });
    fireEvent.change(screen.getByLabelText("Entrega"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(m.listar).toHaveBeenLastCalledWith({ estado: "fallido" }));
  });
});
describe("P20 llamadas exactas", () => {
  it("POST reintento solo manda motivo y codifica id", async () => {
    const api = await vi.importActual<typeof import("@/lib/api/staff")>("@/lib/api/staff");
    await api.reintentarNotificacion("persona/1", motivo);
    expect(m.api).toHaveBeenCalledWith("/api/staff/notificaciones/persona%2F1/reintento", { method: "POST", body: { motivo } });
  });
  it("GET cadena codifica el id sin cuerpo", async () => {
    const api = await vi.importActual<typeof import("@/lib/api/staff")>("@/lib/api/staff");
    await api.cadenaNotificacion("persona/1");
    expect(m.api).toHaveBeenCalledWith("/api/staff/notificaciones/persona%2F1/reintentos");
  });
});
