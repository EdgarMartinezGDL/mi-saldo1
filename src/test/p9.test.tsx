import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasoAlta } from "@/components/caja/paso-alta";
import { MisDatos } from "@/components/cuenta/secciones";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  alta: vi.fn(), perfil: vi.fn(), solicitar: vi.fn(), confirmar: vi.fn(), error: vi.fn(),
}));
vi.mock("@/components/caja/caja-extra", () => ({ altaCliente: mocks.alta, configReferidos: async () => ({ activo: false }) }));
vi.mock("@/components/caja/caja-contexto", () => ({
  useCaja: () => ({ ejecutar: (fn: () => Promise<unknown>) => fn() }),
  avisarError: mocks.error,
  EncabezadoPaso: () => null,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@/lib/use-desplazar", () => ({ useDesplazarAlAbrir: () => ({ current: null }) }));
vi.mock("@/components/cuenta/cuenta-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/components/cuenta/cuenta-api")>(),
  miPerfil: mocks.perfil, solicitarCorreo: mocks.solicitar, confirmarCorreo: mocks.confirmar,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.alta.mockResolvedValue({ pendiente: false, correo_capturado: "guardado" });
  mocks.solicitar.mockResolvedValue({});
  mocks.confirmar.mockResolvedValue({ correo: "ana.luna@ejemplo.mx" });
});
afterEach(cleanup);

function alta() {
  const hecha = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["aviso-privacidad"], { version: "provisional-2026-10", resumen: "Resumen de prueba" });
  render(<QueryClientProvider client={client}><PasoAlta telefono="3312345678" onVolver={() => {}} onHecha={hecha} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("checkbox"));
  return hecha;
}

function cuenta(perfil: { correo: string | null; correo_sin_confirmar: string | null }) {
  mocks.perfil.mockResolvedValue(perfil);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["perfil"], perfil);
  render(<QueryClientProvider client={client}><MisDatos /></QueryClientProvider>);
  return client;
}

describe("P9 correo obligatorio en Caja", () => {
  it("impide el alta sin correo", async () => {
    alta();
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Dar de alta" })).toBeDisabled();
    expect(mocks.alta).not.toHaveBeenCalled();
  });

  it("impide el alta con ana@", async () => {
    alta();
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@" } });
    expect(screen.getByRole("button", { name: "Dar de alta" })).toBeDisabled();
    expect(mocks.alta).not.toHaveBeenCalled();
  });

  it("envía Ana.Luna@Ejemplo.MX sin espacios exteriores y en minúsculas", async () => {
    const hecha = alta();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "  Ana.Luna@Ejemplo.MX  " } });
    fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
    await waitFor(() => expect(hecha).toHaveBeenCalled());
    expect(mocks.alta).toHaveBeenCalledWith(expect.objectContaining({ correo: "ana.luna@ejemplo.mx" }));
  });

  it("mantiene el manejo de error 400 del servidor", async () => {
    const error = new ApiError(400, { codigo: "correo_invalido", message: "Correo inválido" });
    mocks.alta.mockRejectedValueOnce(error);
    const hecha = alta();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@ejemplo.mx" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(error));
    expect(hecha).not.toHaveBeenCalled();
  });
});

describe("P9 correo sin confirmar en Cuenta", () => {
  it("precarga el correo capturado, permite cambiarlo y confirma con PIN y código", async () => {
    const client = cuenta({ correo: null, correo_sin_confirmar: "ana@ejemplo.mx" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar correo" }));
    expect(screen.getByLabelText("Correo nuevo")).toHaveValue("ana@ejemplo.mx");
    fireEvent.change(screen.getByLabelText("Correo nuevo"), { target: { value: "ana.luna@ejemplo.mx" } });
    fireEvent.change(screen.getByLabelText("Tu PIN"), { target: { value: "4927" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await waitFor(() => expect(mocks.solicitar).toHaveBeenCalledWith("4927", "ana.luna@ejemplo.mx"));
    const codigo = await screen.findByLabelText("Código del correo");
    fireEvent.change(codigo, { target: { value: "492781" } });
    const botones = screen.getAllByRole("button", { name: "Confirmar correo" });
    const confirmar = botones[botones.length - 1];
    if (!confirmar) throw new Error("Falta el botón de confirmación");
    fireEvent.click(confirmar);
    await waitFor(() => expect(mocks.confirmar).toHaveBeenCalledWith("492781"));
    await waitFor(() => expect(client.getQueryData(["perfil"])).toEqual({ correo: "ana.luna@ejemplo.mx", correo_sin_confirmar: null }));
    expect(screen.queryByLabelText("Correo nuevo")).toBeNull();
    client.clear();
  });

  it("no precarga el correo sin confirmar si ya hay uno confirmado", () => {
    const client = cuenta({ correo: "confirmado@ejemplo.mx", correo_sin_confirmar: "ana@ejemplo.mx" });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar correo" }));
    expect(screen.getByLabelText("Correo nuevo")).toHaveValue("");
    client.clear();
  });

  it("deja el formulario vacío cuando no existe ningún correo", () => {
    const client = cuenta({ correo: null, correo_sin_confirmar: null });
    fireEvent.click(screen.getByRole("button", { name: "Agregar correo" }));
    expect(screen.getByLabelText("Correo nuevo")).toHaveValue("");
    client.clear();
  });
});