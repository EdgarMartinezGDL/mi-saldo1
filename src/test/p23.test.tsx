import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { ReactNode, ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { Encabezado } from "@/components/cuenta/secciones";
import { Route as LoginRoute } from "@/routes/login";
import { MiSaldoProvider, useMiSaldo } from "@/components/misaldo-provider";
import styles from "@/styles.css?raw";
import panel from "@/routes/panel.tsx?raw";
import membresia from "@/components/membresia.tsx?raw";

const m = vi.hoisted(() => ({ path: "/panel" }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a {...props} href={to}>{children}</a>,
  useNavigate: () => () => {},
  useRouterState: () => m.path,
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: "dueno" } } }) }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ abrir: () => {}, varios: false, dialogo: null }) }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({ pedirConfirmacion: () => {}, dialogo: null }) }));
vi.mock("@/lib/use-mis-validaciones", () => ({ useMisValidaciones: () => ({ data: { validaciones: [] } }) }));
vi.mock("@/components/aviso-pendiente", () => ({ AvisoPendiente: () => null }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: { nombre: "Ana", telefono: "5512345678" } }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});

describe("P23 branding", () => {
  it.each(["/panel", "/caja"])("Caja destacada es naranja en %s", (path) => {
    m.path = path;
    render(<AppShell>Contenido</AppShell>);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    const caja = within(nav).getByRole("link", { name: "Caja" });
    const boton = caja.querySelector("span");
    expect(boton).toHaveClass("btn-accion", "text-accent-foreground");
    expect(boton).not.toHaveClass("btn-premium");
    expect(caja.querySelector("svg")).toHaveClass("size-7");
  });

  it("logo del encabezado sin negocio de 48 px sin recorte", () => {
    render(<AppShell>Contenido</AppShell>);
    const logo = screen.getByRole("img", { name: "Mi Saldo Vip" });
    expect(logo).toHaveAttribute("height", "48");
    expect(logo).toHaveClass("h-12", "w-auto", "object-contain", "shrink-0");
    expect(logo.className).not.toMatch(/rounded-|overflow-hidden/);
  });

  it("logo de Entrada de 128 px", () => {
    const Login = (LoginRoute as unknown as { options: { component: ComponentType } }).options.component;
    render(<Login />);
    const logo = screen.getByRole("img", { name: "Mi Saldo Vip" });
    expect(logo).toHaveAttribute("width", "128");
    expect(logo).toHaveAttribute("height", "128");
    expect(logo).toHaveClass("size-32", "object-contain");
  });

  it("logo de Cuenta de 96 px", () => {
    render(<Encabezado />);
    const logo = screen.getByRole("img", { name: "Mi Saldo Vip" });
    expect(logo).toHaveAttribute("width", "96");
    expect(logo).toHaveAttribute("height", "96");
    expect(logo).toHaveClass("size-24", "object-contain");
  });

  it("primario claro azul oscuro y oscuro verde menta", () => {
    const root = styles.match(/:root\s*\{([^}]+)\}/)?.[1];
    const dark = styles.match(/\.dark\s*\{([^}]+)\}/)?.[1];
    expect(root).toMatch(/--primary:\s*#1e293b\s*;/i);
    expect(dark).toMatch(/--primary:\s*#10b981\s*;/i);
  });

  it("barra verde carbón en ambos modos", () => {
    const root = styles.match(/:root\s*\{([^}]+)\}/)?.[1];
    const dark = styles.match(/\.dark\s*\{([^}]+)\}/)?.[1];
    expect(root).toMatch(/--barra:\s*#232e21\s*;/i);
    expect(dark).toMatch(/--barra:\s*#232e21\s*;/i);
  });

  it("éxito claro verde de la paleta", () => {
    const root = styles.match(/:root\s*\{([^}]+)\}/)?.[1];
    expect(root).toMatch(/--success:\s*#10b981\s*;/i);
  });

  it("ningún archivo conserva el turquesa retirado", () => {
    const archivos = import.meta.glob(["/src/**/*", "!/src/test/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    for (const [ruta, contenido] of Object.entries(archivos)) {
      expect(contenido, ruta).not.toMatch(/0f766e|0b7a5e/i);
    }
    const manifest = readFileSync("public/manifest.webmanifest", "utf8");
    expect(manifest).not.toMatch(/0f766e|0b7a5e/i);
  });

  it('"Ir a la caja" del Panel es un botón de acción naranja', () => {
    expect(panel).toMatch(/to="\/caja"[\s\S]{0,300}btn-accion[\s\S]{0,300}text-accent-foreground/);
    expect(panel).not.toMatch(/to="\/caja"[\s\S]{0,300}btn-premium/);
  });

  it("personalizado sobrescribe primary, su letra y el ring", () => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "personalizado", customColor: "#123456" }));
    function Preferencias() {
      const { theme } = useMiSaldo();
      return <span>{theme}</span>;
    }
    render(<MiSaldoProvider><Preferencias /></MiSaldoProvider>);
    expect(screen.getByText("personalizado")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#123456");
    expect(document.documentElement.style.getPropertyValue("--primary-foreground")).toBe("#ffffff");
    expect(document.documentElement.style.getPropertyValue("--ring")).toBe("#123456");
  });

  it.each([
    ["#FFEB3B", "#1E293B"],
    ["#232E21", "#ffffff"],
  ])("personalizado con %s usa letra %s", (customColor, letra) => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "personalizado", customColor }));
    render(<MiSaldoProvider>{null}</MiSaldoProvider>);
    expect(document.documentElement.style.getPropertyValue("--primary-foreground")).toBe(letra);
  });

  it("el botón de WhatsApp usa el verde oficial #25D366", () => {
    expect(membresia).toContain('"#25D366"');
    expect(membresia).toMatch(/Ya pagué, enviar comprobante/);
    const boton = membresia.match(/function BotonWhatsApp[\s\S]*?Ya pagué, enviar comprobante/)?.[0] ?? "";
    expect(boton).toContain("text-white");
    expect(boton).not.toContain("bg-success-fill");
  });
});