import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TarjetaPrecioMembresia } from "@/components/staff/precio-membresia";
import { api, ApiError } from "@/lib/api/client";
import { fijarPrecioMembresia, precioMembresia, type PrecioMembresia } from "@/lib/api/staff";

const m = vi.hoisted(() => ({ admin: true, api: vi.fn(), success: vi.fn() }));
vi.mock("@/components/staff/comun", () => ({ useNivelStaff: () => ({ esAdmin: m.admin }) }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("sonner", () => ({ toast: { success: m.success } }));
const vigente: PrecioMembresia = { precio_mensual_centavos: 29900, moneda: "MXN", motivo: "Precio de prueba local", factor: "totp", desde: "2026-10-20T04:10:00.123+00:00", staff: { persona_id: "sofia", nombre: "Sofía Demo" } };
function montar(precio: PrecioMembresia | null = vigente) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["precio-membresia"], { vigente: precio, historial: precio ? [precio] : [] });
  m.api.mockResolvedValue({ vigente: precio, historial: precio ? [precio] : [] });
  render(<QueryClientProvider client={client}><TarjetaPrecioMembresia /></QueryClientProvider>);
  return client;
}
function abrir(precio = "349.00") {
  fireEvent.click(screen.getByRole("button", { name: /Cambiar precio|Fijar precio/ }));
  fireEvent.change(screen.getByLabelText("Precio mensual (MXN)"), { target: { value: precio } });
  fireEvent.change(screen.getByLabelText("Motivo del cambio"), { target: { value: "Precio de lanzamiento" } });
  fireEvent.change(screen.getByLabelText("Código del autenticador", { selector: "input:not([type=radio])" }), { target: { value: "123456" } });
}
beforeEach(() => { vi.clearAllMocks(); m.admin = true; });
afterEach(cleanup);
describe("P13 contrato", () => {
  it("consulta el endpoint indicado", async () => { await precioMembresia(); expect(api).toHaveBeenCalledWith("/api/staff/membresia/precio"); });
  it("envía únicamente autenticador", async () => {
    const body = { precio_mensual_centavos: 29900, motivo: "Precio de prueba local", codigo_totp: "123456" };
    await fijarPrecioMembresia(body); expect(api).toHaveBeenCalledWith("/api/staff/membresia/precio", { method: "PUT", body });
  });
  it("envía únicamente PIN", async () => {
    const body = { precio_mensual_centavos: 34900, motivo: "Precio de lanzamiento", pin: "730194" };
    await fijarPrecioMembresia(body); expect(api).toHaveBeenCalledWith("/api/staff/membresia/precio", { method: "PUT", body });
  });
});
describe("P13 permisos y validación", () => {
  it("soporte puede leer precio e historial pero no abrir cambio", () => {
    m.admin = false; montar();
    expect(screen.getByRole("button", { name: "Ver historial" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cambiar precio" })).toBeNull();
  });
  it("admin puede fijar el primer precio", () => { montar(null); abrir("299.00"); expect(screen.getByRole("button", { name: "Guardar precio" })).toBeEnabled(); });
  it.each([["9.99", false], ["10.00", true], ["100000.00", true], ["100000.01", false], ["349,00", true], ["no", false]])("precio %s válido=%s", (valor, valido) => {
    montar(); abrir(valor as string); m.api.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(valido);
  });
  it.each([[4, false], [5, true], [200, true], [201, false]])("motivo de %i válido=%s", (largo, valido) => {
    montar(); abrir(); fireEvent.change(screen.getByLabelText("Motivo del cambio"), { target: { value: "m".repeat(largo) } });
    m.api.mockReturnValue(new Promise(() => {})); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(valido);
  });
  it("autenticador requiere seis dígitos", () => {
    montar(); abrir(); fireEvent.change(screen.getByLabelText("Código del autenticador", { selector: "input:not([type=radio])" }), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(false);
  });
  it.each([[3, false], [4, true], [128, true], [129, false]])("PIN actual de %i válido=%s", (largo, valido) => {
    montar(); abrir(); fireEvent.click(screen.getByRole("radio", { name: "Mi PIN" }));
    fireEvent.change(screen.getByLabelText("Mi PIN", { selector: "input:not([type=radio])" }), { target: { value: "7".repeat(largo) } });
    m.api.mockReturnValue(new Promise(() => {})); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(valido);
  });
});
describe("P13 cambio y errores", () => {
  it("convierte pesos con dos decimales y doble envío no duplica", async () => {
    montar(); abrir("299.99"); m.api.mockReturnValue(new Promise(() => {}));
    const b = screen.getByRole("button", { name: "Guardar precio" }); fireEvent.click(b); fireEvent.click(b);
    const puts = m.api.mock.calls.filter(([, opciones]) => opciones?.method === "PUT");
    expect(puts).toHaveLength(1); expect(puts[0]?.[1].body).toEqual({ precio_mensual_centavos: 29999, motivo: "Precio de lanzamiento", codigo_totp: "123456" });
  });
  it.each([true, false])("200 cambiado=%s cierra y recarga", async (cambiado) => {
    const qc = montar(); abrir(); m.api.mockImplementation(async (_path, options) => options?.method === "PUT"
      ? { cambiado, vigente: { ...vigente, precio_mensual_centavos: 34900 }, anterior: vigente }
      : { vigente: { ...vigente, precio_mensual_centavos: 34900 }, historial: [vigente] });
    fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(m.success).toHaveBeenCalledTimes(1); expect(qc.getQueryState(["precio-membresia"])?.dataUpdateCount).toBeGreaterThan(1);
  });
  it.each(["totp", "pin"])("422 borra solo %s y conserva datos", async (factor) => {
    montar(); abrir();
    if (factor === "pin") { fireEvent.click(screen.getByRole("radio", { name: "Mi PIN" })); fireEvent.change(screen.getByLabelText("Mi PIN", { selector: "input:not([type=radio])" }), { target: { value: "730194" } }); }
    m.api.mockRejectedValue(new ApiError(422, { codigo: factor === "pin" ? "pin_incorrecto" : "codigo_incorrecto", message: "Confirmación incorrecta", intentos_restantes: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    await screen.findByRole("alert"); expect(screen.getByRole("alert").textContent).toContain("4 intentos");
    expect(screen.getByLabelText("Precio mensual (MXN)")).toHaveValue("349.00"); expect(screen.getByLabelText("Motivo del cambio")).toHaveValue("Precio de lanzamiento");
    expect(screen.getByLabelText(factor === "pin" ? "Mi PIN" : "Código del autenticador", { selector: "input:not([type=radio])" })).toHaveValue("");
  });
  it("429 convierte Retry-After 900 segundos a 15 minutos", async () => {
    montar(); abrir(); m.api.mockRejectedValue(new ApiError(429, {}, 900)); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect((await screen.findByRole("alert")).textContent).toContain("15 minutos");
  });
  it("400 muestra el primer mensaje del arreglo", async () => {
    montar(); abrir(); m.api.mockRejectedValue(new ApiError(400, { message: ["Precio fuera de rango", "Otro error"] })); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Precio fuera de rango");
  });
  it("403 mantiene el diálogo sin reenviar", async () => {
    montar(); abrir(); m.api.mockRejectedValue(new ApiError(403, { codigo: "sin_permiso" })); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    await screen.findByRole("alert"); expect(screen.getByRole("dialog")).toBeInTheDocument(); expect(m.api.mock.calls.filter(([, o]) => o?.method === "PUT")).toHaveLength(1);
  });
  it("cerrar borra la confirmación y reabre con autenticador vacío", () => {
    montar(); abrir(); fireEvent.click(screen.getByRole("radio", { name: "Mi PIN" })); fireEvent.change(screen.getByLabelText("Mi PIN", { selector: "input:not([type=radio])" }), { target: { value: "730194" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); fireEvent.click(screen.getByRole("button", { name: "Cambiar precio" }));
    expect(screen.getByRole("radio", { name: "Código del autenticador" })).toBeChecked(); expect(screen.getByLabelText("Código del autenticador", { selector: "input:not([type=radio])" })).toHaveValue("");
  });
});
describe("P13b envío desde formulario", () => {
  it.each(["$1,299.99 MXN", "299,99", "1,299", "100,000.00"])("admite formato %s", (valor) => {
    montar(); abrir(valor); m.api.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    const esperado = valor === "299,99" ? 29999 : valor === "100,000.00" ? 10000000 : valor === "1,299" ? 129900 : 129999;
    expect(m.api.mock.calls.find(([, o]) => o?.method === "PUT")?.[1].body.precio_mensual_centavos).toBe(esperado);
  });
  it("rechaza más de dos decimales y enfoca precio", () => {
    montar(); abrir("299.999"); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(false);
    expect(screen.getByLabelText("Precio mensual (MXN)")).toHaveFocus();
  });
  it.each(["totp", "pin"])("lee valores visibles sin eventos con %s", (factor) => {
    montar(); abrir();
    if (factor === "pin") fireEvent.click(screen.getByRole("radio", { name: "Mi PIN" }));
    const asignar = (elemento: HTMLElement, valor: string) => {
      const prototipo = elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototipo, "value")?.set?.call(elemento, valor);
    };
    asignar(screen.getByLabelText("Precio mensual (MXN)"), "299.99");
    asignar(screen.getByLabelText("Motivo del cambio"), "Cambio desde formulario");
    asignar(screen.getByLabelText(factor === "pin" ? "Mi PIN" : "Código del autenticador", { selector: "input:not([type=radio])" }), "730194");
    m.api.mockReturnValue(new Promise(() => {})); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.find(([, o]) => o?.method === "PUT")?.[1].body).toEqual({ precio_mensual_centavos: 29999, motivo: "Cambio desde formulario", ...(factor === "pin" ? { pin: "730194" } : { codigo_totp: "730194" }) });
  });
  it.each(["precio", "motivo", "totp", "pin"])("permite intentar con %s vacío y enfoca el campo", (campo) => {
    montar(); abrir();
    if (campo === "pin") fireEvent.click(screen.getByRole("radio", { name: "Mi PIN" }));
    const elemento = screen.getByLabelText(campo === "precio" ? "Precio mensual (MXN)" : campo === "motivo" ? "Motivo del cambio" : campo === "pin" ? "Mi PIN" : "Código del autenticador", { selector: "input:not([type=radio]),textarea" });
    fireEvent.change(elemento, { target: { value: "" } });
    const boton = screen.getByRole("button", { name: "Guardar precio" }); expect(boton).toBeEnabled(); fireEvent.click(boton);
    expect(elemento).toHaveFocus(); expect(m.api.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(false);
  });
  it("envía valores recibidos solo por input", () => {
    montar(); abrir(); fireEvent.input(screen.getByLabelText("Precio mensual (MXN)"), { target: { value: "299,99" } });
    fireEvent.input(screen.getByLabelText("Motivo del cambio"), { target: { value: "Sugerencia teclado" } });
    fireEvent.input(screen.getByLabelText("Código del autenticador", { selector: "input:not([type=radio])" }), { target: { value: "730194" } });
    m.api.mockReturnValue(new Promise(() => {})); fireEvent.click(screen.getByRole("button", { name: "Guardar precio" }));
    expect(m.api.mock.calls.find(([, o]) => o?.method === "PUT")?.[1].body).toEqual({ precio_mensual_centavos: 29999, motivo: "Sugerencia teclado", codigo_totp: "730194" });
  });
});