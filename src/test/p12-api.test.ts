import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { avisoPrivacidad, avisoQuery } from "@/lib/api/privacidad";
import { aceptarAviso } from "@/lib/api/cliente";
import { crearPago, pagoMembresia, pagosMembresia, verificarPago, pagoSimulado, pagarSimulado, pagarOxxoSimulado, intervaloPago } from "@/lib/api/pagos";
import { completarActivacion, completarInvitacion } from "@/lib/api/enlaces";
import { altaCliente } from "@/components/caja/caja-extra";

vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: vi.fn().mockResolvedValue({}) }));
afterEach(() => vi.clearAllMocks());
describe("P12 contratos", () => {
  it("obtiene el aviso sin sesión y lo conserva cinco minutos", async () => {
    await avisoPrivacidad(); expect(api).toHaveBeenCalledWith("/api/aviso-privacidad", { auth: false });
    expect(avisoQuery().queryKey).toEqual(["aviso-privacidad"]); expect(avisoQuery().staleTime).toBe(300000);
  });
  it("envía la versión aceptada del perfil", async () => {
    await aceptarAviso("provisional-2026-10"); expect(api).toHaveBeenCalledWith("/api/perfil/aviso-privacidad", { method: "POST", body: { version_aviso: "provisional-2026-10" } });
  });
  it("alta envía la versión junto al consentimiento", async () => {
    const body = { telefono: "+525512345678", nombre: "Luis", correo: "luis@ejemplo.mx", acepta_aviso_privacidad: true as const, version_aviso: "provisional-2026-10" };
    await altaCliente(body); expect(api).toHaveBeenCalledWith("/api/clientes", { method: "POST", body });
  });
  it("activación envía la versión mostrada", async () => {
    const body = { token_activacion: "token", pin: "123456", codigo_acumulacion: "1234", codigo_canje: "5678", correo: null, acepta_aviso_privacidad: true as const, version_aviso: "provisional-2026-10" };
    await completarActivacion(body); expect(api).toHaveBeenCalledWith("/api/activacion/completar", { method: "POST", body, auth: false });
  });
  it("invitación envía la versión mostrada", async () => {
    const body = { token_invitacion: "token", pin: "123456", correo: "luis@ejemplo.mx", acepta_aviso_privacidad: true as const, version_aviso: "provisional-2026-10" };
    await completarInvitacion(body); expect(api).toHaveBeenCalledWith("/api/invitacion/completar", { method: "POST", body, auth: false });
  });
  it("crea tarjeta de tres meses con la llave suministrada", async () => {
    const body = { metodo: "tarjeta" as const, meses: 3, idempotency_key: "llave" };
    await crearPago(body); expect(api).toHaveBeenCalledWith("/api/negocio/membresia/pagos", { method: "POST", body });
  });
  it("consulta detalle, historial y verificación en los endpoints indicados", async () => {
    await pagoMembresia("id"); expect(api).toHaveBeenLastCalledWith("/api/negocio/membresia/pagos/id");
    await pagosMembresia(); expect(api).toHaveBeenLastCalledWith("/api/negocio/membresia/pagos");
    await verificarPago("id"); expect(api).toHaveBeenLastCalledWith("/api/negocio/membresia/pagos/id/verificacion", { method: "POST" });
  });
  it("simula tarjeta aprobada y rechazada sin datos de tarjeta", async () => {
    await pagoSimulado("id"); expect(api).toHaveBeenLastCalledWith("/api/pagos-simulados/id");
    await pagarSimulado("id", "aprobado"); expect(api).toHaveBeenLastCalledWith("/api/pagos-simulados/id/pago", { method: "POST", body: { resultado: "aprobado" } });
    await pagarSimulado("id", "rechazado"); expect(api).toHaveBeenLastCalledWith("/api/pagos-simulados/id/pago", { method: "POST", body: { resultado: "rechazado" } });
  });
  it("OXXO genera ficha sin cuerpo y confirma en pago-oxxo", async () => {
    await pagarSimulado("id"); expect(api).toHaveBeenLastCalledWith("/api/pagos-simulados/id/pago", { method: "POST" });
    await pagarOxxoSimulado("id"); expect(api).toHaveBeenLastCalledWith("/api/pagos-simulados/id/pago-oxxo", { method: "POST" });
  });
});
describe("P12 seguimiento", () => {
  it("consulta creado cada tres segundos", () => expect(intervaloPago("creado", 0, 119999)).toBe(3000));
  it("consulta pendiente cada tres segundos", () => expect(intervaloPago("pendiente", 0, 119999)).toBe(3000));
  it("detiene la consulta al cumplir dos minutos", () => expect(intervaloPago("pendiente", 0, 120000)).toBe(false));
  it.each(["aprobado", "rechazado", "cancelado", "en_revision", "vencido"] as const)("no consulta estado %s", (estado) => expect(intervaloPago(estado, 0, 0)).toBe(false));
});