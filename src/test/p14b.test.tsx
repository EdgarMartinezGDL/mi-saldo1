import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Centro } from "@/routes/negocio.index";
import { Horarios } from "@/routes/negocio.horarios";
import { asistente, type Asistente } from "@/lib/api/dueno";
import { guardarHorarios } from "@/lib/api/marketing";
import type { ConfiguracionNegocio, Horario } from "@/lib/api/caja";

const config = vi.hoisted(() => ({
  actual: { horarios: [], negocio: { pin_pos_configurado: true } } as unknown as ConfiguracionNegocio,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a {...props} href={to}>{children}</a>,
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({
  Cargando: () => null,
  RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/negocio/comun", () => ({
  useConfigNegocio: () => ({ data: config.actual, actualizar: vi.fn() }),
  ConConfig: ({ children }: { children: (c: ConfiguracionNegocio) => ReactNode }) => <>{children(config.actual)}</>,
  SeccionNegocio: ({ titulo, children }: { titulo: string; children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/negocio/operacion-ui", () => ({
  useConteosNegocio: () => ({ data: undefined }),
  errorOperacion: vi.fn(),
  Confirmar: ({ abierto, accion, boton }: { abierto: boolean; accion: () => void; boton: string }) =>
    abierto ? <button onClick={accion}>{boton}</button> : null,
}));
vi.mock("@/components/totp-provider", () => ({
  useConTotp: () => (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/api/marketing", () => ({ guardarHorarios: vi.fn() }));
vi.mock("@/lib/api/dueno", () => ({ asistente: vi.fn(), cerrarAsistente: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clientes: QueryClient[] = [];
function montar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(qc);
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return qc;
}

const negocio = (horarios: Horario[]) => ({ horarios, negocio: { pin_pos_configurado: true } }) as unknown as ConfiguracionNegocio;
const semana = (abierto: (d: number) => boolean): Horario[] =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => (abierto(d) ? { dia_semana: d, cerrado: false, hora_apertura: "09:00", hora_cierre: "19:00" } : { dia_semana: d, cerrado: true, hora_apertura: null, hora_cierre: null }));

function conPendientes(n: number): Asistente {
  const obligatorios = ["horarios", "modulos", "pin_pos"].slice(0, n) as Asistente["pendientes_obligatorios"];
  return {
    configuracion_completa: false, mostrar_asistente: true, asistente_cerrado_en: null,
    pendientes_obligatorios: obligatorios,
    pasos: [
      { paso: "datos", obligatorio: false, completo: true, tiene_logo: false, tema_id: 1 },
      { paso: "horarios", obligatorio: true, completo: !obligatorios.includes("horarios") },
      { paso: "modulos", obligatorio: true, completo: !obligatorios.includes("modulos"), monedero: "pendiente", tarjetas_sellos: "pendiente" },
      { paso: "pin_pos", obligatorio: true, completo: !obligatorios.includes("pin_pos") },
      { paso: "empleados", obligatorio: false, completo: false, empleados_activos: 0 },
      { paso: "referidos", obligatorio: false, completo: false, disponible: true },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  config.actual = negocio([]);
});
afterEach(() => {
  cleanup();
  clientes.forEach((qc) => qc.clear());
  clientes.length = 0;
});

describe("P14b · guardar el horario sugerido", () => {
  it("sin horarios guardados, la propuesta se guarda sin tocar nada", async () => {
    vi.mocked(guardarHorarios).mockImplementation(async (h) => h);
    montar(<Horarios cfg={negocio([])} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const guardar = screen.getByRole("button", { name: "Guardar horarios" });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);
    fireEvent.click(screen.getByRole("button", { name: "Sí, guardar" }));
    await waitFor(() => expect(guardarHorarios).toHaveBeenCalledTimes(1));
    const cuerpo = vi.mocked(guardarHorarios).mock.calls[0]![0];
    expect(cuerpo.filter((x) => !x.cerrado)).toHaveLength(6);
    expect(cuerpo.find((x) => x.dia_semana === 0)).toEqual({ dia_semana: 0, cerrado: true, hora_apertura: null, hora_cierre: null });
    expect(cuerpo.find((x) => x.dia_semana === 1)).toEqual({ dia_semana: 1, cerrado: false, hora_apertura: "09:00", hora_cierre: "19:00" });
  });

  it("un día abierto sin hora sigue bloqueando el guardado", () => {
    montar(<Horarios cfg={negocio([])} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Lunes: abre"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeDisabled();
  });

  it("con horarios guardados sigue haciendo falta un cambio", () => {
    montar(<Horarios cfg={negocio(semana((d) => d !== 0))} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Lunes abierto"));
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeEnabled();
  });
});

describe("P14b · tarjeta Configuración inicial", () => {
  async function tarjeta(n: number) {
    const datos = conPendientes(n);
    vi.mocked(asistente).mockResolvedValue(datos);
    const qc = montar(<Centro />);
    qc.setQueryData(["asistente"], datos);
    await waitFor(() => expect(screen.getByText("Termina de configurar tu negocio para empezar a cobrar.")).toBeInTheDocument());
  }

  it("con un pendiente dice «Te falta 1 paso obligatorio.» una sola vez", async () => {
    await tarjeta(1);
    expect(screen.getAllByText("Te falta 1 paso obligatorio.")).toHaveLength(1);
    expect(screen.queryByText(/1 pasos obligatorios/)).toBeNull();
    expect(screen.queryByText(/Te faltan 1/)).toBeNull();
  });

  it("con dos pendientes dice «Te faltan 2 pasos obligatorios.»", async () => {
    await tarjeta(2);
    expect(screen.getAllByText("Te faltan 2 pasos obligatorios.")).toHaveLength(1);
  });

  it("con tres pendientes dice «Te faltan 3 pasos obligatorios.»", async () => {
    await tarjeta(3);
    expect(screen.getAllByText("Te faltan 3 pasos obligatorios.")).toHaveLength(1);
  });
});
