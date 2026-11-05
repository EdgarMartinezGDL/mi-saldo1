import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAV, roleHome } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Centro } from "@/routes/negocio.index";
import { Route as LoginRoute } from "@/routes/login";

const m = vi.hoisted(() => ({ asistente: vi.fn(), config: vi.fn(), conteos: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a {...props} href={to}>{children}</a>,
  useNavigate: () => () => {},
}));
vi.mock("@/components/app-shell", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/app-shell")>();
  return { ...real, AppShell: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => m.asistente() }));
vi.mock("@/components/negocio/comun", () => ({ useConfigNegocio: () => m.config() }));
vi.mock("@/components/negocio/operacion-ui", () => ({ useConteosNegocio: () => m.conteos() }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</> }));

const clients: QueryClient[] = [];
function pagina() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><Centro /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  m.config.mockReturnValue({ data: { negocio: { pin_pos_configurado: true } } });
  m.conteos.mockReturnValue({ data: { reclamaciones: 0, solicitudes: 0 } });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("P22 navegación", () => {
  it("menú del dueño: Inicio, Clientes, Caja, Negocio, Cuenta", () => {
    expect(NAV.dueno.map((i) => i.label)).toEqual(["Inicio", "Clientes", "Caja", "Negocio", "Cuenta"]);
    expect(NAV.dueno.find((i) => i.label === "Caja")?.destacado).toBe(true);
  });
  it("menú del empleado: Mi jornada, Caja, Cuenta", () => {
    expect(NAV.empleado.map((i) => i.label)).toEqual(["Mi jornada", "Caja", "Cuenta"]);
    expect(NAV.empleado.find((i) => i.label === "Caja")?.destacado).toBe(true);
  });
  it("roleHome usa el mapa fijo", () => {
    expect(roleHome("empleado")).toBe("/caja");
    expect(roleHome("dueno")).toBe("/panel");
    expect(roleHome("cliente")).toBe("/");
    expect(roleHome("staff")).toBe("/staff");
  });
});

describe("P22 Centro de Negocio", () => {
  it("muestra las 3 secciones con sus tarjetas", () => {
    m.asistente.mockReturnValue({ data: { configuracion_completa: true, pendientes_obligatorios: [] } });
    pagina();
    const operacion = screen.getByRole("heading", { name: "Operación" });
    const marketing = screen.getByRole("heading", { name: "Marketing y recompensas" });
    const administracion = screen.getByRole("heading", { name: "Administración" });
    expect(operacion).toBeInTheDocument();
    expect(marketing).toBeInTheDocument();
    expect(administracion).toBeInTheDocument();
    expect(within(operacion.parentElement!).getByText("Empleados")).toBeInTheDocument();
    expect(within(operacion.parentElement!).getByText("PIN POS")).toBeInTheDocument();
    expect(within(marketing.parentElement!).getByText("Monedero y tarjetas de sellos")).toBeInTheDocument();
    expect(within(administracion.parentElement!).getByText("Membresía y pagos")).toBeInTheDocument();
    expect(within(administracion.parentElement!).getByText("Movimientos")).toBeInTheDocument();
  });

  it("con configuración incompleta, Configuración inicial va antes de Operación con su alerta", () => {
    m.asistente.mockReturnValue({ data: { configuracion_completa: false, pendientes_obligatorios: ["horarios", "pin"] } });
    const { container } = pagina();
    const inicial = screen.getByText("Configuración inicial");
    expect(screen.getByText("Te faltan 2 pasos obligatorios.")).toBeInTheDocument();
    const posInicial = Array.from(container.querySelectorAll("a, h2")).findIndex((el) => el.textContent?.includes("Configuración inicial"));
    const posOperacion = Array.from(container.querySelectorAll("a, h2")).findIndex((el) => el.textContent === "Operación");
    expect(posInicial).toBeGreaterThanOrEqual(0);
    expect(posOperacion).toBeGreaterThan(posInicial);
    expect(inicial).toBeInTheDocument();
  });

  it("con configuración completa, Configuración inicial va dentro de Marketing y recompensas sin alerta", () => {
    m.asistente.mockReturnValue({ data: { configuracion_completa: true, pendientes_obligatorios: [] } });
    pagina();
    const marketing = screen.getByRole("heading", { name: "Marketing y recompensas" }).parentElement!;
    expect(within(marketing).getByText("Configuración inicial")).toBeInTheDocument();
    expect(within(marketing).getByText("Revisa los pasos de configuración de tu negocio.")).toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).toBeNull();
  });
});

describe("P22 botones de acción", () => {
  it("el botón por defecto lleva btn-accion", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" }).className).toContain("btn-accion");
  });
});

describe("P22 logo desde public/", () => {
  const Login = (LoginRoute as unknown as { options: { component: ComponentType } }).options.component;

  it("la entrada muestra el logo circular servido desde /marca/", () => {
    render(<Login />);
    const logo = screen.getByRole("img", { name: "Mi Saldo Vip" });
    expect(logo).toHaveAttribute("src", "/marca/mi-saldo-vip-circular.png");
    expect(logo).toHaveAttribute("alt", "Mi Saldo Vip");
  });

  it("si el logo no carga, se esconde y se ve la marca en texto", () => {
    render(<Login />);
    const logo = screen.getByRole("img", { name: "Mi Saldo Vip" });
    fireEvent.error(logo);
    expect(screen.queryByRole("img", { name: "Mi Saldo Vip" })).toBeNull();
    expect(screen.getAllByText("Mi Saldo").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Vip").length).toBeGreaterThanOrEqual(2);
  });

  it("ningún archivo de src/ (fuera de pruebas) referencia __l5e ni .asset.json", () => {
    const archivos = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [ruta, contenido] of Object.entries(archivos)) {
      if (ruta.startsWith("/src/test/")) continue;
      expect(contenido, ruta).not.toContain("__l5e");
      expect(contenido, ruta).not.toContain(".asset.json");
    }
  });
});
