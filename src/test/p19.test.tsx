import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as FichaRoute } from "@/routes/mi-negocio";
import { Route as InicioRoute } from "@/routes/index";
import { Route as MarcaRoute } from "@/routes/negocio.marca";
import type { FichaNegocio } from "@/lib/api/cliente";
import { DIAS_SEMANA, enlaceMapa, textoEstadoHorario } from "@/lib/api/formato";
import { ApiError } from "@/lib/api/client";

const m = vi.hoisted(() => ({ ficha: vi.fn(), resumen: vi.fn(), perfil: vi.fn(), referidos: vi.fn(), guardar: vi.fn(), actualizar: vi.fn(), invalidar: vi.fn(), updateBusiness: vi.fn(), error: vi.fn(), negocioId: "10000000-0000-4000-8000-00000000d102" }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a {...props} href={to}>{children}</a>,
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "cliente", negocio_id: m.negocioId } } }) }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => <span>Cargando</span> }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ updateBusiness: m.updateBusiness, theme: "oscuro", setTheme: vi.fn(), customColor: "", setCustomColor: vi.fn(), restoreDefaultColors: vi.fn() }) }));
vi.mock("@/components/negocio/asistente", () => ({ useInvalidarAsistente: () => m.invalidar, validarBusquedaAsistente: () => ({}) }));
vi.mock("@/components/negocio/comun", () => ({
  SeccionNegocio: ({ children }: { children: ReactNode }) => <>{children}</>,
  ConConfig: ({ children }: { children: (cfg: object) => ReactNode }) => children({ negocio: { nombre_comercial: "Barbería Demo", giro: "barbería", logo_url: null, tema_id: 2, direccion: null, telefono_contacto: null, telefono_es_whatsapp: false } }),
  useConfigNegocio: () => ({ actualizar: m.actualizar }), mostrarError: m.error,
}));
vi.mock("@/lib/api/cliente", () => ({ fichaNegocio: m.ficha, resumen: m.resumen, perfil: m.perfil, referidos: m.referidos }));
vi.mock("@/lib/api/dueno", () => ({ actualizarNegocio: m.guardar }));
vi.mock("sonner", () => ({ toast: { error: m.error, success: vi.fn() } }));

const ficha: FichaNegocio = {
  negocio_id: "10000000-0000-4000-8000-00000000d102", nombre_comercial: "Barbería Demo", giro: "barbería", logo_url: null, tema_id: 2,
  zona_horaria: "America/Mexico_City", direccion: null, telefono_contacto: null, telefono_es_whatsapp: false,
  horarios: Array.from({ length: 7 }, (_, d) => ({ dia_semana: d, cerrado: d === 0, hora_apertura: d === 0 ? null : "10:00", hora_cierre: d === 0 ? null : "20:00" })),
  horario_publicado: true, hoy_dia_semana: 2, abierto_ahora: false, cierra_a: null, abre_proximo: { dia_semana: 3, hora: "10:00", en_dias: 1 },
};
const clients: QueryClient[] = [];
function pagina(route: { options: { component?: unknown } }) {
  const Component = route.options.component as (() => ReactNode) | undefined;
  if (!Component) throw new Error("Falta pantalla");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return { ...render(<QueryClientProvider client={client}><Component /></QueryClientProvider>), client };
}
async function editar() { pagina(MarcaRoute); fireEvent.click(screen.getByRole("button", { name: "Editar" })); }
beforeEach(() => {
  vi.clearAllMocks(); m.negocioId = ficha.negocio_id;
  m.ficha.mockResolvedValue(ficha);
  m.resumen.mockResolvedValue({ negocio: { nombre_comercial: "Barbería Demo", logo_url: null, moneda: "MXN" }, tarjetas: null, monedero: { saldo_centavos: 5000, factor_cashback: 0.05 } });
  m.perfil.mockResolvedValue({ nombre: "Diego" }); m.referidos.mockResolvedValue({ programa: null, recomendados: [] });
  m.guardar.mockImplementation(async (body) => ({ ...body, telefono_contacto: body.telefono_contacto?.replace(/\s/g, "") ?? null }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });

describe("P19 formato", () => {
  it("sin horario", () => expect(textoEstadoHorario({ ...ficha, horario_publicado: false })).toBe("Horario no disponible"));
  it("abierto usa el cierre del servidor", () => expect(textoEstadoHorario({ ...ficha, abierto_ahora: true, cierra_a: "20:00" })).toBe("Abierto · cierra a las 20:00"));
  it.each([
    [0, 3, "Cerrado · abre hoy a las 10:00"],
    [1, 3, "Cerrado · abre mañana a las 10:00"],
    [3, 5, "Cerrado · abre el viernes a las 10:00"],
  ])("próxima apertura en %i días", (en_dias, dia_semana, expected) => expect(textoEstadoHorario({ ...ficha, abre_proximo: { en_dias, dia_semana, hora: "10:00" } })).toBe(expected));
  it("todos cerrados", () => expect(textoEstadoHorario({ ...ficha, abre_proximo: null })).toBe("Cerrado"));
  it("codifica el nombre y la dirección para Maps", () => expect(enlaceMapa("Barbería Demo", "Av. Juárez 10")).toBe("https://www.google.com/maps/search/?api=1&query=Barber%C3%ADa%20Demo%2C%20Av.%20Ju%C3%A1rez%2010"));
});

describe("P19 ficha", () => {
  it("ordena lunes a domingo y resalta el hoy del servidor", async () => {
    pagina(FichaRoute); const rows = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(7);
    [1, 2, 3, 4, 5, 6, 0].forEach((d, i) => expect(rows[i]).toHaveTextContent(DIAS_SEMANA[d] ?? ""));
    expect(rows[1]).toHaveTextContent("MartesHoy"); expect(rows[6]).toHaveTextContent("DomingoCerrado");
    expect(screen.getByText("Hoy").closest("li")).toBe(rows[1]);
  });
  it("sin contacto muestra el estado vacío", async () => { pagina(FichaRoute); expect(await screen.findByText("El negocio aún no agrega su dirección ni su teléfono.")).toBeInTheDocument(); });
  it.each([true, false])("WhatsApp depende del servidor: %s", async (whatsapp) => {
    m.ficha.mockResolvedValue({ ...ficha, telefono_contacto: "+523312345678", telefono_es_whatsapp: whatsapp }); pagina(FichaRoute);
    expect(await screen.findByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+523312345678");
    if (whatsapp) expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/523312345678");
    else expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
  });
  it("dirección abre Maps", async () => {
    m.ficha.mockResolvedValue({ ...ficha, direccion: "Av. Juárez 10" }); pagina(FichaRoute);
    expect(await screen.findByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", enlaceMapa("Barbería Demo", "Av. Juárez 10"));
  });
  it("turno nocturno cierra al día siguiente", async () => {
    m.ficha.mockResolvedValue({ ...ficha, horarios: [{ dia_semana: 1, cerrado: false, hora_apertura: "18:00", hora_cierre: "02:00" }] }); pagina(FichaRoute);
    expect(await screen.findByText("18:00 a 02:00 (del día siguiente)")).toBeInTheDocument();
  });
  it("horario no publicado no muestra días", async () => {
    m.ficha.mockResolvedValue({ ...ficha, horario_publicado: false, horarios: [], abierto_ahora: null, abre_proximo: null }); pagina(FichaRoute);
    expect(await screen.findByText("Este negocio aún no publica su horario.")).toBeInTheDocument(); expect(screen.queryByRole("list")).toBeNull();
  });
  it.each(["solo_cliente", "sin_permiso"])("error %s admite reintento", async (codigo) => {
    m.ficha.mockRejectedValueOnce(new ApiError(403, { codigo, message: "Acceso no permitido" })); pagina(FichaRoute);
    expect(await screen.findByText("Acceso no permitido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await screen.findByRole("list"); expect(m.ficha).toHaveBeenCalledTimes(2);
  });
  it("cambiar de negocio usa otra consulta", async () => {
    const { client, rerender } = pagina(FichaRoute); await screen.findByRole("heading", { name: "Barbería Demo" });
    m.negocioId = "farmacia"; m.ficha.mockResolvedValue({ ...ficha, negocio_id: "farmacia", nombre_comercial: "Farmacia Demo" });
    const Component = FichaRoute.options.component;
    if (!Component) throw new Error("Falta ficha");
    rerender(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
    await screen.findByRole("heading", { name: "Farmacia Demo" }); expect(m.ficha).toHaveBeenCalledTimes(2);
  });
});

describe("P19 Inicio", () => {
  it("franja cargada enlaza la ficha", async () => {
    pagina(InicioRoute);
    expect(await screen.findByRole("link", { name: "Cerrado · abre mañana a las 10:00. Ver horario y ubicación de Barbería Demo" })).toHaveAttribute("href", "/mi-negocio");
    expect(screen.getByText("Saldo disponible")).toBeInTheDocument();
  });
  it("fallo de ficha no oculta el saldo ni avisa", async () => {
    m.ficha.mockRejectedValue(new Error("Sin conexión")); pagina(InicioRoute); await screen.findByText("Saldo disponible");
    await waitFor(() => expect(m.ficha).toHaveBeenCalled()); expect(screen.queryByRole("link", { name: /Ver horario y ubicación/ })).toBeNull(); expect(m.error).not.toHaveBeenCalled();
  });
  it("ficha cargando no muestra franja", async () => {
    m.ficha.mockReturnValue(new Promise(() => {})); pagina(InicioRoute); await screen.findByText("Saldo disponible"); expect(screen.queryByRole("link", { name: /Ver horario y ubicación/ })).toBeNull();
  });
});

describe("P19 Datos y marca", () => {
  it("guarda contacto y lee el número normalizado del servidor", async () => {
    await editar(); fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: " Av. Juárez 10, Centro, Guadalajara " } });
    fireEvent.change(screen.getByLabelText("Teléfono del negocio"), { target: { value: " +52 33 1234 5678 " } }); fireEvent.click(screen.getByRole("switch", { name: "Este número tiene WhatsApp" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(m.guardar).toHaveBeenCalledWith({ nombre_comercial: "Barbería Demo", giro: "barbería", logo_url: null, tema_id: 2, direccion: "Av. Juárez 10, Centro, Guadalajara", telefono_contacto: "+52 33 1234 5678", telefono_es_whatsapp: true }));
    expect(await screen.findByText("+523312345678 (WhatsApp)")).toBeInTheDocument();
  });
  it("teléfono vacío borra número y WhatsApp", async () => {
    await editar(); fireEvent.change(screen.getByLabelText("Teléfono del negocio"), { target: { value: "+523312345678" } }); fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByLabelText("Teléfono del negocio"), { target: { value: " " } });
    expect(screen.getByRole("switch")).toBeDisabled(); fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(m.guardar).toHaveBeenCalledWith(expect.objectContaining({ direccion: null, telefono_contacto: null, telefono_es_whatsapp: false })));
  });
  it("sin + rechaza el teléfono antes de llamar API", async () => {
    await editar(); fireEvent.change(screen.getByLabelText("Teléfono del negocio"), { target: { value: "3312345678" } }); fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    expect(m.guardar).not.toHaveBeenCalled(); expect(m.error).toHaveBeenCalledWith("El teléfono debe empezar con + y la lada del país, por ejemplo +52 33 1234 5678");
  });
});