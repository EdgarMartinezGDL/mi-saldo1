import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromocionesVigentes } from "@/components/cliente/promociones-vigentes";
import { NegociosCliente } from "@/components/mis-negocios";
import { NAV } from "@/components/app-shell";
import { diaMes } from "@/lib/api/formato";
import inicioRaw from "@/routes/index.tsx?raw";
import canjearRaw from "@/routes/canjear.tsx?raw";
import ajustesRaw from "@/routes/ajustes.tsx?raw";

const m = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), negocio: "uno", toastOk: vi.fn(), toastErr: vi.fn(), setSesion: vi.fn() }));
vi.mock("@/lib/api/client", async (o) => ({ ...await o<typeof import("@/lib/api/client")>(), api: m.api, setSesion: m.setSesion }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  useNavigate: () => m.navigate,
  useRouterState: () => "/",
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: "cliente", negocio_id: m.negocio } }, conectado: true }) }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ updateBusiness: () => {} }) }));
vi.mock("sonner", () => ({ toast: { success: m.toastOk, error: m.toastErr } }));

const promo = (id: string, negocio_id: string, extra: object = {}) => ({
  promocion_id: id, negocio_id, negocio: negocio_id === "uno" ? "Café" : "Otro", titulo: `Promo ${id}`, cuerpo: `Cuerpo ${id}`,
  ruta: "/", vigente_hasta: "2026-11-29", enviada_en: "2026-11-22T18:00:00Z", ...extra,
});
let qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); m.negocio = "uno";
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); qc.clear(); });
const montar = (ui: ReactNode) => render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
const vigentes = (lista: object[]) => m.api.mockImplementation(async (path: string) => {
  if (path === "/api/cliente/promociones/vigentes") return { promociones: lista };
  return {};
});

describe("P47 promociones en Inicio (cliente)", () => {
  it("solo las del negocio actual, con 'Válida hasta el …', sin convertir zona horaria", async () => {
    vigentes([promo("a", "uno"), promo("b", "uno", { vigente_hasta: "2026-12-01" }), promo("c", "dos")]);
    montar(<PromocionesVigentes />);
    expect(await screen.findByRole("heading", { name: "Promociones" })).toBeInTheDocument();
    expect(screen.getByText("Promo a")).toBeInTheDocument();
    expect(screen.getByText("Promo b")).toBeInTheDocument();
    expect(screen.queryByText("Promo c")).toBeNull();
    expect(screen.getByText("Válida hasta el 29 de noviembre")).toBeInTheDocument();
    expect(screen.getByText("Válida hasta el 1 de diciembre")).toBeInTheDocument();
    expect(m.api).toHaveBeenCalledWith("/api/cliente/promociones/vigentes");
  });
  it("sin promociones del negocio actual no hay tarjeta; si la API falla, tampoco", async () => {
    vigentes([promo("c", "dos")]);
    const v = montar(<PromocionesVigentes />);
    await waitFor(() => expect(m.api).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText("Promociones")).toBeNull();
    v.unmount(); qc.clear();
    m.api.mockRejectedValue(new Error("caída"));
    montar(<PromocionesVigentes />);
    await waitFor(() => expect(m.api).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByText("Promociones")).toBeNull();
  });
  it("con 4: 3 visibles y 'Ver todas (4)'; ruta interna es enlace y una externa no", async () => {
    vigentes([promo("a", "uno", { ruta: "/historial" }), promo("b", "uno", { ruta: "//evil.com" }), promo("c", "uno"), promo("d", "uno")]);
    montar(<PromocionesVigentes />);
    await screen.findByText("Promo a");
    expect(screen.queryByText("Promo d")).toBeNull();
    expect(screen.getByText("Promo a").closest("a")).toHaveAttribute("href", "/historial");
    expect(screen.getByText("Promo b").closest("a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas (4)" }));
    expect(screen.getByText("Promo d")).toBeInTheDocument();
  });
  it("título y cuerpo con <b> se muestran como texto", async () => {
    vigentes([promo("a", "uno", { titulo: "<b>Hoy</b>", cuerpo: "<img src=x onerror=alert(1)>" })]);
    const { container } = montar(<PromocionesVigentes />);
    expect(await screen.findByText("<b>Hoy</b>")).toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("b, img")).toBeNull();
  });
  it("Inicio pone las promociones antes de 'Tus PINes' y ya no tiene el buscador (U-11)", () => {
    expect(inicioRaw.indexOf("<PromocionesVigentes />")).toBeGreaterThan(inicioRaw.indexOf("Tus tarjetas de sellos"));
    expect(inicioRaw.indexOf("<PromocionesVigentes />")).toBeLessThan(inicioRaw.indexOf("<TusPines"));
    expect(inicioRaw).not.toContain("Buscar establecimiento");
  });
  it("diaMes no cambia de día por la zona horaria", () => {
    expect(diaMes("2026-01-01")).toBe("1 de enero");
    expect(diaMes("2026-12-31")).toBe("31 de diciembre");
  });
});

describe("U-11 negocios como botones en Inicio", () => {
  const ctx = (negocio_id: string, nombre: string, actual = false, extra: object = {}) =>
    ({ rol: "cliente", negocio_id, nombre_comercial: nombre, actual, requiere_pin: false, requiere_totp: false, ...extra });
  const contextos = (lista: object[]) => m.api.mockImplementation(async (path: string) => {
    if (path === "/api/auth/contextos") return { contextos: lista };
    if (path === "/api/auth/cambio-contexto") return { contexto: { rol: "cliente", negocio_id: "dos", nombre_comercial: "Nevería" } };
    return {};
  });
  it("con un solo negocio de cliente no aparece", async () => {
    contextos([ctx("uno", "Café", true), { ...ctx("uno", "Café"), rol: "dueno" }]);
    montar(<NegociosCliente />);
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/auth/contextos"));
    await act(async () => {});
    expect(screen.queryByRole("navigation", { name: "Tus negocios" })).toBeNull();
  });
  it("con dos: el actual marcado; tocar otro cambia de negocio y vuelve a Inicio", async () => {
    contextos([ctx("uno", "Café", true), ctx("dos", "Nevería")]);
    montar(<NegociosCliente />);
    const actual = await screen.findByRole("button", { name: "Café" });
    expect(actual).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Nevería" }));
    await waitFor(() => expect(m.api).toHaveBeenCalledWith("/api/auth/cambio-contexto", { method: "POST", body: { rol: "cliente", negocio_id: "dos" } }));
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(m.toastOk).toHaveBeenCalledWith(expect.stringContaining("Nevería"));
  });
  it("si el cambio pide PIN, no lo intenta directo (abre Mis negocios)", async () => {
    contextos([ctx("uno", "Café", true), ctx("dos", "Nevería", false, { requiere_pin: true })]);
    montar(<NegociosCliente />);
    fireEvent.click(await screen.findByRole("button", { name: "Nevería" }));
    await act(async () => {});
    expect(m.api).not.toHaveBeenCalledWith("/api/auth/cambio-contexto", expect.anything());
  });
});

describe("U-12 pestaña Premios y PINes en Cuenta", () => {
  it("la barra del cliente dice Premios (misma ruta /canjear)", () => {
    expect(NAV.cliente.map((i) => i.label)).toEqual(["Inicio", "Premios", "Historial", "Cuenta"]);
    expect(NAV.cliente[1].to).toBe("/canjear");
  });
  it("Premios ya no administra los PIN: lo hace Cuenta, con ancla #mis-pines", () => {
    expect(canjearRaw).toContain("Premios");
    expect(canjearRaw).not.toContain("TarjetaMisCodigos");
    expect(canjearRaw).toContain("<PromocionesVigentes />");
    expect(ajustesRaw).toMatch(/id="mis-pines"[\s\S]{0,80}<TarjetaMisCodigos \/>/);
  });
});
