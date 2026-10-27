import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvisoPrueba } from "@/components/staff/portafolios";
import { AccionesPersona } from "@/components/staff/ficha-acciones";
import { MiSaldoProvider, useMiSaldo } from "@/components/misaldo-provider";
import type { FichaPersona } from "@/lib/api/staff";

const mocks = vi.hoisted(() => ({ avisoPrueba: vi.fn(), solicitarTelefono: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock("@/lib/api/staff", async (original) => ({
  ...(await original<typeof import("@/lib/api/staff")>()),
  avisoPrueba: mocks.avisoPrueba,
  solicitarTelefono: mocks.solicitarTelefono,
}));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe("P6: avisos de prueba", () => {
  it.each([1, 2])("cuenta %i avisos y usa singular/plural", async (cantidad) => {
    mocks.avisoPrueba.mockResolvedValue({ encoladas: Array.from({ length: cantidad }, (_, i) => ({ id: String(i), canal: i ? "correo" : "whatsapp" })) });
    render(<AvisoPrueba negocioId={null} texto="Enviarme un aviso de prueba" />);
    fireEvent.click(screen.getByRole("button", { name: "Enviarme un aviso de prueba" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, enviar" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`Te enviamos ${cantidad} ${cantidad === 1 ? "aviso" : "avisos"} de prueba`));
    expect(mocks.avisoPrueba).toHaveBeenCalledWith(null);
  });
});

describe("P6: asignar teléfono", () => {
  it("muestra la hora sin añadir un segundo punto", async () => {
    const persona: FichaPersona = {
      persona_id: "p6-persona", nombre: "Persona de prueba", apellido_paterno: null, apellido_materno: null,
      telefono: null, correo: "persona@ejemplo.mx", cuenta_activada: true, tiene_2fa: false,
      roles: { dueno: [], empleado: [], cliente: 0, staff: false },
      nacimiento_dia: null, nacimiento_mes: null, eliminada: false, clientes: [],
    };
    mocks.solicitarTelefono.mockResolvedValue({ cambio_id: "p6-cambio", correo: persona.correo, expira_en: "2026-10-07T07:56:00Z" });
    render(<QueryClientProvider client={new QueryClient()}><AccionesPersona f={persona} onCambio={vi.fn()} /></QueryClientProvider>);
    fireEvent.change(screen.getByRole("textbox", { name: "Número nuevo" }), { target: { value: "5512345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    const instrucciones = await screen.findByText(/Le enviamos un código/);
    expect(instrucciones.textContent).toContain(": pídele que te lo dicte.");
    expect(instrucciones.textContent).not.toContain("..");
  });
});

describe("P6: almacenamiento visual", () => {
  it("descarta rol y negocio antiguos, conserva solo tema y color", async () => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ role: "staff", business: { name: "Negocio anterior" }, theme: "claro", customColor: "#123456" }));
    let estado: ReturnType<typeof useMiSaldo> | undefined;
    function Estado() { estado = useMiSaldo(); return <p>{estado.role}</p>; }
    render(<MiSaldoProvider><Estado /></MiSaldoProvider>);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("misaldo-prefs") ?? "{}")).toEqual({ theme: "claro", customColor: "#123456" }));
    expect(estado?.role).toBe("cliente");
    expect(estado?.business.name).not.toBe("Negocio anterior");
    act(() => { estado?.setRole("dueno"); estado?.updateBusiness({ name: "Negocio actual" }); });
    expect(JSON.parse(localStorage.getItem("misaldo-prefs") ?? "{}")).toEqual({ theme: "claro", customColor: "#123456" });
  });
});