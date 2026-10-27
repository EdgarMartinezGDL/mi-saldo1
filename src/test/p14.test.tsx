import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pasosVisibles, PendientesAsistente, useAsistente, useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { BarraAsistente } from "@/components/negocio/barra-asistente";
import { AsistenteInicial } from "@/routes/negocio.asistente";
import { asistente, cerrarAsistente, type Asistente } from "@/lib/api/dueno";

const router = vi.hoisted(() => ({ navigate: vi.fn(), location: { pathname: "/negocio/marca", searchStr: "?asistente=1" } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => router.navigate,
  useLocation: () => router.location,
  Link: ({ to, search, children, ...props }: { to: string; search?: unknown; children: ReactNode }) =>
    <a {...props} href={to} onClick={(e) => { e.preventDefault(); router.navigate({ to, search }); }}>{children}</a>,
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ Cargando: () => null, RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api/dueno", () => ({ asistente: vi.fn(), cerrarAsistente: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function nuevo(): Asistente {
  return { configuracion_completa: false, mostrar_asistente: true, asistente_cerrado_en: null,
    pendientes_obligatorios: ["horarios", "modulos", "pin_pos"], pasos: [
      { paso: "datos", obligatorio: false, completo: true, tiene_logo: false, tema_id: 1 },
      { paso: "horarios", obligatorio: true, completo: false },
      { paso: "modulos", obligatorio: true, completo: false, monedero: "pendiente", tarjetas_sellos: "pendiente" },
      { paso: "pin_pos", obligatorio: true, completo: false },
      { paso: "empleados", obligatorio: false, completo: false, empleados_activos: 0 },
      { paso: "referidos", obligatorio: false, completo: false, disponible: true },
    ] };
}
const clientes: QueryClient[] = [];
function montar(ui: ReactNode, datos = nuevo()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(qc);
  qc.setQueryData(["asistente"], datos);
  vi.mocked(asistente).mockResolvedValue(datos);
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return qc;
}
beforeEach(() => { vi.clearAllMocks(); router.location = { pathname: "/negocio/marca", searchStr: "?asistente=1" }; });
afterEach(() => { cleanup(); clientes.forEach((qc) => qc.clear()); clientes.length = 0; });

describe("P14 reglas y navegación", () => {
  it("respeta los tres obligatorios del negocio nuevo", () => {
    const estado = nuevo();
    expect(pasosVisibles(estado).filter((p) => p.obligatorio).map((p) => p.paso)).toEqual(["horarios", "modulos", "pin_pos"]);
  });
  it("referidos no disponible queda fuera del conteo y del recorrido", () => {
    const estado = nuevo(); estado.pasos = estado.pasos.map((p) => p.paso === "referidos" ? { ...p, disponible: false } : p);
    expect(pasosVisibles(estado).map((p) => p.paso)).toEqual(["datos", "horarios", "modulos", "pin_pos", "empleados"]);
  });
  it("solo conserva el indicador explícito asistente=1", () => {
    expect(validarBusquedaAsistente({ asistente: 1 })).toEqual({ asistente: 1 });
    expect(validarBusquedaAsistente({ asistente: 1 })).toEqual({ asistente: 1 });
    expect(validarBusquedaAsistente({ asistente: "0" })).toEqual({});
  });
  it("sin indicador no consulta el asistente", () => {
    router.location.searchStr = "";
    montar(<BarraAsistente />);
    expect(asistente).not.toHaveBeenCalled();
  });
  it("la barra no se activa en otras pantallas", () => {
    router.location.pathname = "/negocio/reportes";
    montar(<BarraAsistente />);
    expect(asistente).not.toHaveBeenCalled();
  });
  it("no bloquea avanzar desde un obligatorio pendiente", () => {
    router.location.pathname = "/negocio/horarios";
    montar(<BarraAsistente />);
    fireEvent.click(screen.getByRole("link", { name: "Siguiente" }));
    expect(router.navigate).toHaveBeenCalledWith({ to: "/negocio/monedero", search: { asistente: 1 } });
  });
  it("omite empleados pendientes y vuelve a la lista si es el último visible", () => {
    router.location.pathname = "/empleados";
    const estado = nuevo(); estado.pasos = estado.pasos.map((p) => p.paso === "referidos" ? { ...p, disponible: false } : p);
    montar(<BarraAsistente />, estado);
    fireEvent.click(screen.getByRole("link", { name: "Omitir" }));
    expect(router.navigate).toHaveBeenCalledWith({ to: "/negocio/asistente", search: {} });
  });
  it("un opcional completo avanza al siguiente visible", () => {
    montar(<BarraAsistente />);
    fireEvent.click(screen.getByRole("link", { name: "Siguiente" }));
    expect(router.navigate).toHaveBeenCalledWith({ to: "/negocio/horarios", search: { asistente: 1 } });
  });
  it("la lista reutiliza la pantalla existente de módulos", () => {
    montar(<AsistenteInicial />);
    fireEvent.click(screen.getAllByRole("link", { name: "Configurar" })[1] as HTMLElement);
    expect(router.navigate).toHaveBeenCalledWith({ to: "/negocio/monedero", search: { asistente: 1 } });
  });
  it("cierre pendiente cachea el servidor antes de volver al Panel", async () => {
    const respuesta = { ...nuevo(), mostrar_asistente: false, asistente_cerrado_en: "2026-10-21T02:00:00Z" };
    vi.mocked(cerrarAsistente).mockResolvedValue(respuesta);
    const qc = montar(<AsistenteInicial />);
    fireEvent.click(screen.getByRole("button", { name: "Terminar después" }));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith({ to: "/panel" }));
    expect(qc.getQueryData(["asistente"])).toEqual(respuesta);
    expect(cerrarAsistente).toHaveBeenCalledTimes(1);
  });
  it("cierre completo no conserva pendientes locales", async () => {
    const completo: Asistente = { ...nuevo(), configuracion_completa: true, pendientes_obligatorios: [], mostrar_asistente: false };
    vi.mocked(cerrarAsistente).mockResolvedValue(completo);
    const qc = montar(<AsistenteInicial />, completo);
    fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith({ to: "/panel" }));
    expect(qc.getQueryData<Asistente>(["asistente"])?.pendientes_obligatorios).toEqual([]);
  });
  it("si falla el cierre no abandona el asistente", async () => {
    vi.mocked(cerrarAsistente).mockRejectedValue(new Error("Sin conexión"));
    montar(<AsistenteInicial />);
    fireEvent.click(screen.getByRole("button", { name: "Terminar después" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Terminar después" })).toBeEnabled());
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it("la invalidación permite retroceder al desactivar la única tarjeta", async () => {
    const completo = { ...nuevo(), configuracion_completa: true, pendientes_obligatorios: [] };
    function Prueba() {
      const consulta = useAsistente(); const invalidar = useInvalidarAsistente();
      return <button onClick={invalidar}>{consulta.data?.configuracion_completa ? "completo" : "pendiente"}</button>;
    }
    const qc = montar(<Prueba />, completo);
    await waitFor(() => expect(asistente).toHaveBeenCalled());
    vi.mocked(asistente).mockResolvedValue({ ...nuevo(), pendientes_obligatorios: ["modulos"] });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(qc.getQueryData<Asistente>(["asistente"])?.pendientes_obligatorios).toEqual(["modulos"]));
    expect(qc.getQueryData<Asistente>(["asistente"])?.configuracion_completa).toBe(false);
  });
  it("pendientes de Panel enlazan al horario existente con la barra", () => {
    montar(<PendientesAsistente datos={{ ...nuevo(), mostrar_asistente: false, pendientes_obligatorios: ["horarios"] }} />);
    fireEvent.click(screen.getByRole("link", { name: "Horarios" }));
    expect(router.navigate).toHaveBeenCalledWith({ to: "/negocio/horarios", search: { asistente: 1 } });
  });
});