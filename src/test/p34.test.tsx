import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
import { colorConContraste, colorTextoConContraste } from "@/components/misaldo-provider";
import { Route as LoginRoute } from "@/routes/login";
import { Route as RecuperarRoute } from "@/routes/recuperar";
import { PaginaNoEncontrada } from "@/components/pagina-no-encontrada";
import appShell from "@/components/app-shell.tsx?raw";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "anonimo", sesion: null }) }));
vi.mock("@/components/app-shell", () => ({ roleHome: () => "/" }));
afterEach(cleanup);

// Independent WCAG calculation: verifies results, not the implementation's formula.
function luminancia(hex: string) {
  const values = hex.slice(1).match(/../g)?.map((v) => parseInt(v, 16) / 255) ?? [];
  const lin = values.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return (lin[0] ?? 0) * 0.2126 + (lin[1] ?? 0) * 0.7152 + (lin[2] ?? 0) * 0.0722;
}
function contraste(a: string, b: string) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("P34 contraste personalizado", () => {
  it("oscurece #3b82f6 para texto blanco", () => {
    const r = colorConContraste("#3b82f6");
    expect(luminancia(r.fondo)).toBeLessThan(luminancia("#3b82f6"));
    expect(r.texto).toBe("#ffffff");
    expect(contraste(r.fondo, r.texto)).toBeGreaterThanOrEqual(4.5);
  });
  it("conserva #2563eb con blanco", () => {
    expect(colorConContraste("#2563eb")).toEqual({ fondo: "#2563eb", texto: "#ffffff" });
  });
  it("amarillo claro usa #1E293B", () => {
    const r = colorConContraste("#fde047");
    expect(r.texto).toBe("#1E293B");
    expect(r.fondo).toBe("#fde047");
    expect(contraste(r.fondo, r.texto)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["#ffffff", "#F43F5E", "#7c3f2f", "#1d4ed8", "#b3261e", "#6b21a8", "#2563EB"])("%s cumple 4.5:1", (hex) => {
    const r = colorConContraste(hex);
    expect(contraste(r.fondo, r.texto)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["#3b82f6", "#2563eb", "#fde047", "#ffffff", "#F43F5E", "#7c3f2f", "#1d4ed8", "#b3261e", "#6b21a8", "#000000"])("texto %s cumple sobre tarjetas claras y oscuras", (hex) => {
    for (const tarjeta of ["#1e293b", "#ffffff"]) {
      expect(contraste(colorTextoConContraste(hex, tarjeta), tarjeta)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("P34 regiones principales", () => {
  const Login = (LoginRoute as unknown as { options: { component: ComponentType } }).options.component;
  const Recuperar = (RecuperarRoute as unknown as { options: { component: ComponentType } }).options.component;
  it.each([["/login", Login], ["/recuperar", Recuperar], ["404", PaginaNoEncontrada]] as const)("%s tiene un main", (_, Pantalla) => {
    render(<Pantalla />);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});

describe("P34 barra superior e inferior", () => {
  it("la co-marca usa logo y la leyenda solo se muestra desde 640 px", () => {
    expect(appShell).toContain('text-xs text-barra-foreground sm:inline">By MicroFix Cloud');
    expect(appShell).not.toContain("Mi Saldo Vip · By MicroFix Cloud");
  });
  it("las etiquetas inferiores usan 12 px y no se parten", () => {
    expect(appShell).toContain('"text-xs leading-tight whitespace-nowrap"');
    expect(appShell).not.toContain('"text-[11px] tracking-tight"');
  });
});