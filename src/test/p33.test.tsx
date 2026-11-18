import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rol, Sesion } from "@/lib/api/client";
import * as sitio from "@/lib/sitio";

const m = vi.hoisted(() => ({
  navigate: vi.fn(), logout: vi.fn(), contextos: vi.fn(), elegir: vi.fn(), staff: vi.fn(),
  pathname: "/login", auth: { estado: "autenticado", sesion: null as Sesion | null },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: m.pathname } }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => m.auth }));
vi.mock("@/components/app-shell", () => ({ roleHome: (r: Rol) => r === "staff" ? "/staff" : "/" }));
vi.mock("@/components/enrolamiento-totp", () => ({ EnrolamientoTotp: () => null }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ updateBusiness: vi.fn() }) }));
vi.mock("@/lib/api/auth", () => ({ logout: m.logout, contextos: m.contextos, elegirContexto: m.elegir, cambiarContexto: vi.fn(), validarTotp: vi.fn() }));
const { GuardaSitio } = await import("@/components/guarda-sitio");
const { ContinuarSesion } = await import("@/components/continuar-sesion");
const { useContextos, useMisNegocios } = await import("@/components/mis-negocios");
const roles: Rol[] = ["cliente", "empleado", "dueno", "staff"];
const contexto = (rol: Rol) => ({ rol, negocio_id: rol === "staff" ? null : "negocio", nombre_comercial: rol === "staff" ? null : "Café", actual: true, requiere_pin: false, requiere_totp: false });
const sesion = (rol: Rol): Sesion => ({ access_token: "prueba", token_type: "Bearer", expires_in: 3600, sesion_expira_en: "2027-01-01T00:00:00Z", contexto: contexto(rol) });
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(sitio, "sitioActual").mockReturnValue("desarrollo");
  m.pathname = "/login";
  m.auth = { estado: "autenticado", sesion: sesion("cliente") };
  m.logout.mockResolvedValue(undefined);
  m.contextos.mockResolvedValue({ contextos: [contexto("dueno"), contexto("staff")] });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("P33 sitios", () => {
  it.each([
    ["admin.si-saldo.com", "admin"], ["si-saldo.com", "publico"], ["www.si-saldo.com", "publico"],
    ["localhost", "desarrollo"], ["127.0.0.1", "desarrollo"], ["::1", "desarrollo"], ["[::1]", "desarrollo"],
    ["192.168.100.10", "desarrollo"], ["10.0.0.5", "desarrollo"], ["172.20.1.1", "desarrollo"],
    ["172.16.0.1", "desarrollo"], ["172.31.255.255", "desarrollo"],
    ["abc-def.trycloudflare.com", "desarrollo"], ["id-preview--abc.lovable.app", "desarrollo"],
    ["preview--abc.test", "desarrollo"], ["a.lovableproject-dev.com", "desarrollo"], ["a.beta.lovable.dev", "desarrollo"],
    ["172.32.0.1", "publico"], ["172.15.0.1", "publico"], ["admin-si-saldo.com", "publico"],
    ["192.168.999.1", "publico"],
  ] as const)("%s → %s", (host, esperado) => expect(sitio.tipoSitio(host)).toBe(esperado));
  for (const tipo of ["admin", "publico", "desarrollo"] as const) {
    for (const rol of roles) {
      it(`${tipo} permite ${rol}: ${tipo === "desarrollo" || (tipo === "admin" ? rol === "staff" : rol !== "staff")}`, () => {
        expect(sitio.rolPermitido(tipo, rol)).toBe(tipo === "desarrollo" || (tipo === "admin" ? rol === "staff" : rol !== "staff"));
      });
    }
  }
});

describe("P33 perfiles", () => {
  it.each(["publico", "admin", "desarrollo"] as const)("selector en %s", (tipo) => {
    vi.mocked(sitio.sitioActual).mockReturnValue(tipo);
    montar(<ContinuarSesion respuesta={{ estado: "seleccionar_contexto", token_seleccion: "prueba", contextos: [contexto("cliente"), contexto("staff")] }} onReiniciar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Como cliente/ }) !== null).toBe(tipo !== "admin");
    expect(screen.queryByRole("button", { name: /Como Staff/ }) !== null).toBe(tipo !== "publico");
  });
  it.each(["publico", "admin"] as const)("sin perfiles permitidos en %s", (tipo) => {
    vi.mocked(sitio.sitioActual).mockReturnValue(tipo);
    montar(<ContinuarSesion respuesta={{ estado: "seleccionar_contexto", token_seleccion: "prueba", contextos: [contexto(tipo === "publico" ? "staff" : "cliente")] }} onReiniciar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: tipo === "admin" ? "Panel de Staff" : "Acceso de Staff" })).toBeInTheDocument();
    expect(m.elegir).not.toHaveBeenCalled();
  });
  it("Mis negocios filtra Staff y oculta la entrada cuando queda un perfil", async () => {
    vi.mocked(sitio.sitioActual).mockReturnValue("publico");
    function Lista() {
      const { lista } = useContextos();
      const { varios, dialogo } = useMisNegocios();
      return <>{varios && <button>Mis negocios</button>}{lista.map((c) => <p key={c.rol}>{c.rol}</p>)}{dialogo}</>;
    }
    montar(<Lista />);
    await screen.findByText("dueno");
    expect(screen.queryByText("staff")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mis negocios" })).toBeNull();
  });
});

describe("P33 guarda y rutas", () => {
  it.each([["publico", "staff", "Acceso de Staff"], ["admin", "cliente", "Panel de Staff"]] as const)("rechaza %s / %s", async (tipo, rol, titulo) => {
    vi.mocked(sitio.sitioActual).mockReturnValue(tipo);
    m.auth.sesion = sesion(rol);
    const vista = render(<StrictMode><GuardaSitio><p>Contenido privado</p></GuardaSitio></StrictMode>);
    await waitFor(() => expect(m.logout).toHaveBeenCalledTimes(1));
    m.auth = { estado: "anonimo", sesion: null };
    vista.rerender(<StrictMode><GuardaSitio><p>Contenido privado</p></GuardaSitio></StrictMode>);
    expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
  });
  it.each(["/staff", "/staff/negocios", "/staff-extra"])("público oculta %s sin montar llamadas Staff ni pedir sesión", (path) => {
    vi.mocked(sitio.sitioActual).mockReturnValue("publico");
    m.pathname = path;
    m.auth = { estado: "anonimo", sesion: null };
    function Staff() { m.staff("/api/staff/resumen"); return <p>Staff privado</p>; }
    montar(<GuardaSitio><Staff /></GuardaSitio>);
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(m.staff).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
  });
  it.each(["/bienvenida", "/activar", "/invitacion", "/confirmar-alta", "/baja"])("admin oculta %s", (path) => {
    vi.mocked(sitio.sitioActual).mockReturnValue("admin");
    m.pathname = path; m.auth = { estado: "anonimo", sesion: null };
    montar(<GuardaSitio><p>Página de clientes</p></GuardaSitio>);
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.queryByText("Página de clientes")).toBeNull();
  });
  it.each([["autenticado", "/staff"], ["anonimo", "/login"]] as const)("inicio admin %s → %s", async (estado, destino) => {
    vi.mocked(sitio.sitioActual).mockReturnValue("admin");
    m.pathname = "/"; m.auth = { estado, sesion: estado === "autenticado" ? sesion("staff") : null };
    montar(<GuardaSitio><p>Inicio cliente</p></GuardaSitio>);
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: destino, replace: true }));
    expect(screen.queryByText("Inicio cliente")).toBeNull();
  });
  it("desarrollo mantiene Staff", () => {
    m.pathname = "/staff"; m.auth.sesion = sesion("staff");
    montar(<GuardaSitio><p>Staff privado</p></GuardaSitio>);
    expect(screen.getByText("Staff privado")).toBeInTheDocument();
    expect(m.logout).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
  });
});