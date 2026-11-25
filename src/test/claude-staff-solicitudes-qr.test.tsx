import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PestanaSolicitudesQr } from "@/components/staff/solicitudes-qr";

const m = vi.hoisted(() => ({ negocios: vi.fn(), detalle: vi.fn(), limpiar: vi.fn(), totp: vi.fn(), admin: true }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => m.totp }));
vi.mock("@/components/staff/comun", async (o) => ({ ...await o<typeof import("@/components/staff/comun")>(), useNivelStaff: () => ({ nivel: m.admin ? "admin" : "soporte", esAdmin: m.admin }) }));
vi.mock("@/lib/api/staff", async (o) => ({ ...await o<typeof import("@/lib/api/staff")>(), negociosSolicitudesQr: m.negocios, solicitudesQrNegocio: m.detalle, limpiarSolicitudesQr: m.limpiar }));

const sol = (id: string, tel: string) => ({ id, telefono: tel, nombre: "X", apellido_paterno: "Y", apellido_materno: null, correo: "f***@ejemplo.mx", creada_en: "2026-11-23T21:10:00Z", expira_en: "2026-11-24T21:10:00Z" });
beforeEach(() => {
  vi.clearAllMocks(); m.admin = true;
  m.totp.mockImplementation((fn: () => unknown) => fn());
  m.negocios.mockResolvedValue({ tope: 200, negocios: [{ negocio_id: "flor", nombre_comercial: "Florería", pendientes: 172, alerta: true, mas_reciente: "2026-11-23T22:10:00Z", ultimo_aviso: "2026-11-23T21:40:00Z" }] });
  m.detalle.mockResolvedValue({ negocio_id: "flor", nombre_comercial: "Florería", tope: 200, pendientes: 172, ultimo_aviso: null,
    por_hora: [{ hora: "2026-11-23T21:00:00Z", solicitudes: 120 }], solicitudes: [sol("a", "+525511110001"), sol("b", "+525511110002")], siguiente: null });
  m.limpiar.mockResolvedValue({ borradas: 1, pendientes: 171 });
});
afterEach(cleanup);

async function abrir() {
  render(<PestanaSolicitudesQr />);
  fireEvent.click(await screen.findByRole("button", { name: /Florería/ }));
  await screen.findByRole("heading", { name: "Florería" });
}

describe("QR-D3 pantalla de Staff", () => {
  it("lista los negocios con su conteo y la alerta del 80 %", async () => {
    render(<PestanaSolicitudesQr />);
    const fila = await screen.findByRole("button", { name: /Florería/ });
    expect(fila).toHaveTextContent("172 / 200");
    expect(fila).toHaveTextContent("Arriba del 80 %");
  });
  it("admin borra las seleccionadas con motivo y 2FA", async () => {
    await abrir();
    const borrar = screen.getByRole("button", { name: "Borrar seleccionadas (0)" });
    expect(borrar).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar 55 1111 0002" }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar seleccionadas (1)" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), { target: { value: "Números en serie" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(m.limpiar).toHaveBeenCalledWith("flor", { ids: ["b"], motivo: "Números en serie" }));
    expect(m.totp).toHaveBeenCalled();
    await waitFor(() => expect(m.detalle).toHaveBeenCalledTimes(2));
  });
  it("borrar desde una hora manda todas + creadas_desde", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Borrar desde aquí" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialogo).getByLabelText("Motivo"), { target: { value: "Ráfaga de la última hora" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(m.limpiar).toHaveBeenCalledWith("flor", { todas: true, creadas_desde: "2026-11-23T21:00:00Z", motivo: "Ráfaga de la última hora" }));
  });
  it("soporte solo revisa: sin casillas ni botones de borrar", async () => {
    m.admin = false;
    await abrir();
    expect(screen.getByText("55 1111 0001")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Borrar/ })).toBeNull();
  });
});
