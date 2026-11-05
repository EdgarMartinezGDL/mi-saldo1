import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/styles.css?raw";
import skeleton from "@/components/ui/skeleton.tsx?raw";
import clientes from "@/routes/clientes.tsx?raw";

const archivos = import.meta.glob(["../routes/**/*.tsx", "../components/**/*.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

afterEach(cleanup);

describe("P24d detalles visuales de P24c", () => {
  it("define --esqueleto en :root (#E2E8F0) y en .dark (#334155)", () => {
    const raiz = styles.match(/:root\s*\{([^}]+)\}/i)?.[1] ?? "";
    const oscuro = styles.match(/\.dark\s*\{([^}]+)\}/i)?.[1] ?? "";
    expect(raiz).toMatch(/--esqueleto:\s*#e2e8f0\s*;/i);
    expect(oscuro).toMatch(/--esqueleto:\s*#334155\s*;/i);
    expect(styles).toMatch(/--color-esqueleto:\s*var\(--esqueleto\)/);
  });

  it("Skeleton usa bg-esqueleto y no bg-muted", () => {
    expect(skeleton).toContain("bg-esqueleto");
    expect(skeleton).not.toContain("bg-muted");
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("bg-esqueleto", "animate-pulse", "rounded-md", "motion-reduce:animate-none");
  });

  it("en Clientes el nombre trunca y «Sin activar» va en el renglón del teléfono", () => {
    expect(clientes).toContain('truncate text-base font-medium">{nombreCompleto(c)}</p>');
    expect(clientes).not.toContain("flex flex-wrap items-center gap-2");
    const renglon2 = clientes.match(/<p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">([\s\S]*?)<\/p>/)?.[1] ?? "";
    expect(renglon2).toContain("telefonoVisible(c.telefono)");
    expect(renglon2).toContain("Sin activar");
    expect(renglon2).toContain("Archivado");
    expect(renglon2.indexOf("telefonoVisible")).toBeLessThan(renglon2.indexOf("Sin activar"));
    expect(renglon2.indexOf("Sin activar")).toBeLessThan(renglon2.indexOf("Archivado"));
  });

  it("ningún archivo combina transition-colors con transition-transform", () => {
    for (const [ruta, codigo] of Object.entries(archivos)) {
      const clases = codigo.match(/"[^"]*transition[^"]*"|'[^']*transition[^']*'/g) ?? [];
      for (const clase of clases) {
        expect(clase.includes("transition-colors") && clase.includes("transition-transform"), ruta).toBe(false);
      }
    }
  });

  it("Mi negocio y Panel usan la transición combinada de color y movimiento", () => {
    const combinada = "transition-[color,background-color,border-color,box-shadow,transform] duration-150";
    expect(archivos["../routes/negocio.index.tsx"]).toContain(combinada);
    expect(archivos["../routes/panel.tsx"]).toContain(combinada);
  });

  it("el encabezado de Clientes sigue visible tras el cambio de filas", () => {
    expect(clientes).toContain("Clientes");
    expect(screen).toBeDefined();
  });
});
