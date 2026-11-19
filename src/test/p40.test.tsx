import type { ComponentType, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiSaldoProvider, useMiSaldo, colorTextoConContraste } from "@/components/misaldo-provider";
import { SelectorFondo } from "@/components/selector-fondo";
import { AppShell } from "@/components/app-shell";
import { Route as AjustesRoute } from "@/routes/ajustes";
import { FONDOS, VARIABLES_FONDO } from "@/lib/fondos";

const m = vi.hoisted(() => ({ nombre: "Café Prueba" as string | null, pendientes: 0 }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), useRouterState: () => "/ajustes", Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined }) }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", conectado: true, sesion: { contexto: { rol: m.nombre ? "empleado" : "staff", nombre_comercial: m.nombre } } }) }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ varios: false }) }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({}) }));
vi.mock("@/components/aviso-pendiente", () => ({ AvisoPendiente: () => null }));
vi.mock("@/lib/use-mis-validaciones", () => ({ useMisValidaciones: () => ({ data: { validaciones: Array.from({ length: m.pendientes }, () => ({ estado: "pendiente" })) } }) }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/cuenta/secciones", () => ({ Encabezado: () => null, MisDatos: () => null, Seguridad: () => null, NotificacionesDispositivo: () => null, Promociones: () => null, Tarjeta: ({ children }: { children: ReactNode }) => <section>{children}</section> }));

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("style"); m.nombre = "Café Prueba"; m.pendientes = 0; });
afterEach(cleanup);
function contraste(a: string, b: string) {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return (c[0] ?? 0) * .2126 + (c[1] ?? 0) * .7152 + (c[2] ?? 0) * .0722;
  };
  return (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
}
function Controles() {
  const p = useMiSaldo();
  return <><output aria-label="Preferencias">{p.theme}/{p.fondo}</output><SelectorFondo />
    <button onClick={() => p.setTheme("claro")}>Modo claro</button><button onClick={() => p.setTheme("oscuro")}>Modo oscuro</button></>;
}
describe("P40 paletas", () => {
  it("tiene los diez ids y cinco fondos por modo", () => {
    expect(FONDOS.map((f) => f.id)).toEqual(["blanco", "crema", "menta", "lavanda", "rosa", "azul-noche", "carbon", "bosque", "vino", "morado"]);
    expect(FONDOS.filter((f) => f.modo === "claro")).toHaveLength(5); expect(FONDOS.filter((f) => f.modo === "oscuro")).toHaveLength(5);
  });
  it.each(FONDOS.filter((f) => f.colores))("$nombre cumple contraste AA", (f) => {
    if (!f.colores) throw new Error("Falta paleta");
    const texto = f.modo === "claro" ? "#1e293b" : "#e2e8f0";
    for (const fondo of [f.colores.background, f.colores.card, f.colores.secondary]) expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
    for (const fondo of [f.colores.background, f.colores.card]) expect(contraste(f.colores["muted-foreground"], fondo)).toBeGreaterThanOrEqual(4.5);
  });
});
describe("P40 proveedor y selector", () => {
  it("selecciona, persiste, relee y limpia variables al cambiar de modo", async () => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "personalizado", customColor: "#2563EB", fondo: "crema" }));
    const vista = render(<MiSaldoProvider><Controles /></MiSaldoProvider>); const root = document.documentElement;
    expect(root).not.toHaveClass("dark"); expect(root.style.getPropertyValue("--background")).toBe("#faf6ee");
    expect(root.style.getPropertyValue("--primary-texto")).toBe(colorTextoConContraste("#2563EB", "#ffffff"));
    expect(root.style.getPropertyValue("--primary-etiqueta")).toBe(colorTextoConContraste("#2563EB", "#f2ecdf"));
    expect(screen.getAllByRole("button", { name: /^Fondo / })).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Fondo Menta" })); expect(screen.getByRole("button", { name: "Fondo Menta" })).toHaveAttribute("aria-pressed", "true"); expect(root.style.getPropertyValue("--background")).toBe("#eff8f4");
    await waitFor(() => expect(JSON.parse(localStorage.getItem("misaldo-prefs") ?? "{}").fondo).toBe("menta"));
    vista.unmount(); render(<MiSaldoProvider><Controles /></MiSaldoProvider>); expect(screen.getByLabelText("Preferencias")).toHaveTextContent("personalizado/menta");
    fireEvent.click(screen.getByRole("button", { name: "Fondo Vino" })); expect(root).toHaveClass("dark"); expect(root.style.getPropertyValue("--card")).toBe("#2e1820"); expect(root.style.getPropertyValue("--muted")).toBe("#43242f");
    for (const modo of ["claro", "oscuro"]) {
      fireEvent.click(screen.getByRole("button", { name: `Modo ${modo}` }));
      expect(root.classList.contains("dark")).toBe(modo === "oscuro");
      for (const v of VARIABLES_FONDO) expect(root.style.getPropertyValue(`--${v}`)).toBe("");
      expect(root.style.getPropertyValue("--primary")).toBe("");
    }
  });
  it.each([undefined, "desconocido"])("preferencias antiguas o inválidas (%s) conservan azul noche", (fondo) => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "personalizado", customColor: "#2563EB", fondo })); render(<MiSaldoProvider><Controles /></MiSaldoProvider>);
    expect(screen.getByLabelText("Preferencias")).toHaveTextContent("personalizado/azul-noche"); expect(document.documentElement).toHaveClass("dark");
    for (const v of VARIABLES_FONDO) expect(document.documentElement.style.getPropertyValue(`--${v}`)).toBe("");
  });
  it("restaura fondo aunque solo haya cambiado el fondo", () => {
    localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "oscuro", customColor: "#2563eb", fondo: "crema" }));
    const Cuenta = (AjustesRoute as unknown as { options: { component: ComponentType } }).options.component;
    render(<MiSaldoProvider><Cuenta /></MiSaldoProvider>); const boton = screen.getByRole("button", { name: "Restaurar colores por defecto" }); expect(boton).toBeEnabled(); fireEvent.click(boton); expect(boton).toBeDisabled();
    expect(JSON.parse(localStorage.getItem("misaldo-prefs") ?? "{}")).toEqual({ theme: "oscuro", customColor: "#2563EB", fondo: "azul-noche" });
  });
});
describe("P40 barra", () => {
  it("con negocio muestra co-marca derecha y respaldo de imagen", () => {
    render(<MiSaldoProvider><AppShell>Cuenta</AppShell></MiSaldoProvider>); const logo = screen.getByRole("img", { name: "Mi Saldo Vip" }); expect(logo).toHaveClass("size-14"); expect(logo).toHaveAttribute("width", "56"); expect(logo).toHaveAttribute("height", "56");
    expect(screen.queryByText("Mi Saldo Vip · By MicroFix Cloud")).toBeNull(); fireEvent.error(logo); expect(screen.queryByRole("img", { name: "Mi Saldo Vip" })).toBeNull(); expect(screen.getByText("Mi Saldo")).toBeInTheDocument();
  });
  it("sin negocio no repite logo", () => {
    m.nombre = null; render(<MiSaldoProvider><AppShell>Staff</AppShell></MiSaldoProvider>); expect(screen.getAllByRole("img", { name: "Mi Saldo Vip" })).toHaveLength(1); expect(screen.getByRole("img", { name: "Mi Saldo Vip" })).not.toHaveAttribute("width", "56");
  });
  it("dos pendientes conviven con el logo", () => {
    m.pendientes = 2; render(<MiSaldoProvider><AppShell>Cuenta</AppShell></MiSaldoProvider>); expect(screen.getByRole("link", { name: "Solicitudes por confirmar: 2" })).toHaveAttribute("href", "/validaciones"); expect(screen.getByRole("img", { name: "Mi Saldo Vip" })).toBeInTheDocument();
  });
});