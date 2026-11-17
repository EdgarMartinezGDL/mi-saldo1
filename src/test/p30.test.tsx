import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarNombreNegocio, enlaceBienvenida } from "@/lib/bienvenida";
import { BotonQrRegistro } from "@/components/qr-registro";
import { Route } from "@/routes/bienvenida";
import { PasoBuscar } from "@/components/caja/paso-buscar";

const m = vi.hoisted(() => ({ nombre: "Tortas Leah" as string | null, rol: "dueno", sesion: true }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: m.sesion ? { contexto: { nombre_comercial: m.nombre, rol: m.rol } } : null }) }));
vi.mock("@/components/app-shell", () => ({ roleHome: (rol: string) => ({ dueno: "/panel", empleado: "/caja", cliente: "/", staff: "/staff" })[rol] }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options }), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@/components/caja/caja-contexto", () => ({ useCaja: () => ({ moneda: "MXN", ejecutar: (fn: () => unknown) => fn() }), avisarError: vi.fn() }));

beforeEach(() => { m.nombre = "Tortas Leah"; m.rol = "dueno"; m.sesion = true; history.replaceState(null, "", "/"); });
afterEach(async () => { cleanup(); await new Promise((resolve) => setTimeout(resolve, 30)); vi.restoreAllMocks(); });

describe("Nombre de bienvenida", () => {
  it("conserva el nombre tal cual", () => expect(limpiarNombreNegocio("Tortas Leah")).toBe("Tortas Leah"));
  it("conserva el porcentaje literal", () => expect(limpiarNombreNegocio("Café 100% natural")).toBe("Café 100% natural"));
  it("no decodifica secuencias con porcentaje", () => expect(limpiarNombreNegocio("Promo 50%25")).toBe("Promo 50%25"));
  it.each([null, "", "   "])("rechaza nombre ausente o vacío: %s", (valor) => expect(limpiarNombreNegocio(valor)).toBeNull());
  it.each(["Café 100% natural", "Promo 50%25", "Café & Pan", "A+B"])("ida y vuelta conserva: %s", (nombre) => {
    const enlace = enlaceBienvenida("https://x.test", nombre);
    const leido = new URLSearchParams(enlace.slice(enlace.indexOf("#") + 1)).get("n");
    expect(limpiarNombreNegocio(leido)).toBe(nombre);
  });
  it("quita dirección y saltos de línea", () => expect(limpiarNombreNegocio("Tortas\u202E\n Leah")).toBe("Tortas Leah"));
  it("quita todos los rangos de control y dirección", () => expect(limpiarNombreNegocio("A\u0000\u001F\u007F\u009F\u200E\u200F\u202A\u202E\u2066\u2069B")).toBe("AB"));
  it("junta espacios y recorta", () => expect(limpiarNombreNegocio("  Tortas   Leah  ")).toBe("Tortas Leah"));
  it("limita a 150 caracteres", () => expect(limpiarNombreNegocio("a".repeat(151))).toBe("a".repeat(150)));
  it("codifica el nombre solo en el fragmento", () => expect(enlaceBienvenida("https://x.test", "Café & Pan")).toBe("https://x.test/bienvenida#n=Caf%C3%A9%20%26%20Pan"));
});

function bienvenida() {
  const C = Route.options.component as () => ReactNode;
  return render(<C />);
}
describe("Bienvenida pública", () => {
  it("lee nombre y conserva fragmento", () => { history.replaceState(null, "", "/bienvenida#n=Tortas%20Leah"); bienvenida(); expect(screen.getByRole("heading", { name: "Te damos la bienvenida a Tortas Leah" })).toBeInTheDocument(); expect(window.location.hash).toBe("#n=Tortas%20Leah"); });
  it("trata HTML como texto, no como elementos", () => { history.replaceState(null, "", "/bienvenida#n=<img src=x onerror=alert(1)>"); const view = bienvenida(); expect(screen.getByRole("heading", { name: "Te damos la bienvenida a <img src=x onerror=alert(1)>" })).toBeInTheDocument(); expect(view.container.querySelector("img")).toBeNull(); });
  it("sin nombre muestra bienvenida genérica", () => { bienvenida(); expect(screen.getByRole("heading", { name: "Te damos la bienvenida a Mi Saldo Vip" })).toBeInTheDocument(); });
  it.each(["cliente", "dueno", "empleado", "staff"])("sesión %s entra al inicio de su rol", (rol) => { m.rol = rol; bienvenida(); expect(screen.getByRole("link", { name: "Ir a mi app" })).toHaveAttribute("href", ({ cliente: "/", dueno: "/panel", empleado: "/caja", staff: "/staff" })[rol]); });
  it("sin sesión lleva a entrar", () => { m.sesion = false; bienvenida(); expect(screen.getByRole("link", { name: "Ya tengo cuenta: entrar" })).toHaveAttribute("href", "/login"); });
});

describe("QR de registro", () => {
  it.each([null, "", "%E0%A4%A"])("no aparece sin nombre válido: %s", (nombre) => { m.nombre = nombre; render(<BotonQrRegistro />); expect(screen.queryByRole("button")).toBeNull(); });
  it.each(["cliente", "staff"])("no aparece para %s", (rol) => { m.rol = rol; render(<BotonQrRegistro />); expect(screen.queryByRole("button")).toBeNull(); });
  it("abre el QR y Esc cierra devolviendo el foco y el historial", async () => {
    const previo = history.length; const cambio = vi.fn(); render(<BotonQrRegistro onAbiertoChange={cambio} />);
    const boton = screen.getByRole("button", { name: "Mostrar QR de registro" }); fireEvent.click(boton);
    expect(screen.getByRole("dialog", { name: "QR de registro" })).toBeInTheDocument(); expect(screen.getByLabelText("Código QR de registro").tagName).toBe("svg"); expect(history.length).toBe(previo + 1); expect(cambio).toHaveBeenLastCalledWith(true); expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull(); expect(boton).toHaveFocus(); expect(cambio).toHaveBeenLastCalledWith(false); await waitFor(() => expect(history.state?.qrRegistro).toBeUndefined());
  });
  it("atrás cierra sin retroceder otra entrada", async () => { render(<BotonQrRegistro />); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" })); history.back(); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(window.location.pathname).toBe("/"); });
  it("libera el bloqueo de pantalla al cerrar", async () => {
    const release = vi.fn().mockResolvedValue(undefined); const request = vi.fn().mockResolvedValue({ release }); vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { wakeLock: { request } }));
    render(<BotonQrRegistro />); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" })); await waitFor(() => expect(request).toHaveBeenCalledWith("screen")); fireEvent.click(screen.getByRole("button", { name: "Cerrar" })); await waitFor(() => expect(release).toHaveBeenCalledTimes(1)); vi.unstubAllGlobals();
  });
  it("conserva teléfono y bloquea teclas mientras está abierto", () => {
    render(<PasoBuscar inicial="3312" onAlta={vi.fn()} onEncontrado={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Mostrar QR de registro" })); fireEvent.keyDown(window, { key: "9" }); fireEvent.keyDown(window, { key: "Escape" }); expect(screen.getByText("33 12")).toBeInTheDocument(); fireEvent.keyDown(window, { key: "3" }); expect(screen.getByText("33 123")).toBeInTheDocument();
  });
});