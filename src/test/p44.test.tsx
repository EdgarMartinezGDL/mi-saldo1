import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as PanelRoute } from "@/routes/panel";
import { Registro } from "@/routes/registro";
import { ApiError } from "@/lib/api/client";

const m = vi.hoisted(() => ({ api: vi.fn(), altas: 2, rol: "dueno" as string | null, codigo404: false, resultado: "pendiente" }));
vi.mock("@/lib/api/client", async (original) => ({ ...await original<typeof import("@/lib/api/client")>(), api: m.api }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: m.rol ? "autenticado" : "anonimo", sesion: m.rol ? { contexto: { rol: m.rol, nombre_comercial: "Café & Pan" } } : null }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</>, Cargando: () => null }));
vi.mock("@/components/negocio/asistente", () => ({ useAsistente: () => ({}), PendientesAsistente: () => null }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useNavigate: () => vi.fn(), Link: ({ to, search: _search, children, ...props }: { to: string; search?: unknown; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/lib/api/auth", () => ({ cambiarContexto: vi.fn(), logout: vi.fn() }));

const clients: QueryClient[] = [];
function montar(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
const Panel = (PanelRoute as unknown as { options: { component: ComponentType } }).options.component;
beforeEach(() => {
  vi.clearAllMocks(); m.altas = 2; m.rol = "dueno"; m.codigo404 = false; m.resultado = "pendiente";
  history.replaceState(null, "", "/registro#c=ABC123");
  m.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/dashboard")) return { periodo: { hasta: "2026-11-20" }, clientes: { atendidos: 3, altas: m.altas, activos_total: 57, archivados_total: 0, bajas: 0 }, reclamaciones: { pendientes: 0 }, validaciones_alta: { pendientes: 0 }, cajeros: [], serie: [] };
    if (path === "/api/negocio/membresia") return {};
    if (path === "/api/negocio/configuracion") return { negocio: { pin_pos_configurado: true } };
    if (path === "/api/registro/mi-codigo") { if (m.codigo404) throw new ApiError(404, {}); return { codigo: "ABC123" }; }
    if (path === "/api/registro/negocio/ABC123") return { nombre_comercial: "Café & Pan" };
    if (path === "/api/aviso-privacidad") return { version: "v1", resumen: "Aviso vigente", vigente: true };
    if (path === "/api/registro/solicitar") return { estado: m.resultado, expira_en: "2026-11-21T02:00:00Z" };
    throw new Error(path);
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.restoreAllMocks(); });

describe("P44 disponibilidad de invitaciones", () => {
  it.each([["dueno", false, true], ["dueno", true, false], ["empleado", false, false]] as const)("rol %s y sin código %s", async (rol, sinCodigo, visible) => {
    m.rol = rol; m.codigo404 = sinCodigo; montar(<Panel />);
    await screen.findByText("Cómo va tu negocio hoy.");
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/registro/mi-codigo"));
    if (visible) {
      await screen.findByRole("heading", { name: "Invita a tus clientes" });
      expect(screen.getByLabelText("Enlace de registro")).toHaveValue(`${location.origin}/registro#c=ABC123`);
      expect(screen.getByRole("button", { name: "Copiar enlace" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
    } else {
      await waitFor(() => expect(screen.getByRole("button", { name: "Mostrar QR de registro" })).toBeInTheDocument());
      expect(screen.queryByRole("heading", { name: "Invita a tus clientes" })).toBeNull();
    }
  });
});

describe("P44 conteos del servidor", () => {
  it.each([2, 0])("altas=%s y activos_total=57 enlazan a Clientes", async (altas) => {
    m.altas = altas; montar(<Panel />);
    const nuevos = await screen.findByRole("link", { name: new RegExp(`${altas} Clientes nuevos hoy`) });
    expect(nuevos).toHaveAttribute("href", "/clientes");
    expect(within(nuevos).getByText(String(altas))).toBeInTheDocument();
    const total = screen.getByRole("link", { name: "57 Clientes en total" });
    expect(total).toHaveAttribute("href", "/clientes");
    expect(within(total).getByText("57")).toBeInTheDocument();
  });
});

describe("P44 pasos solo antes del registro", () => {
  it.each(["pendiente", "cuenta_existente"])("se ocultan tras %s", async (resultado) => {
    m.rol = null; m.resultado = resultado; montar(<Registro />);
    await screen.findByText("¿Cómo funciona?");
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("En tu próxima compra en Café & Pan, dale tu número de celular al cajero.")).toBeInTheDocument();
    for (const [label, value] of [["Nombre", "Nora"], ["Apellido paterno", "López"], ["Tu celular (10 dígitos)", "5512345678"], ["Día", "3"], ["Mes", "2"], ["Correo electrónico", "n@c.mx"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await screen.findByText("Aviso vigente"); fireEvent.click(screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar mi registro" }));
    await screen.findByRole("heading", { name: resultado === "pendiente" ? "¡Listo, Nora!" : "Ya existe una cuenta con este número" });
    expect(screen.queryByText("¿Cómo funciona?")).toBeNull();
  });
});