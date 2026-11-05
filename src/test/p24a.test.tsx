import { describe, expect, it } from "vitest";
import styles from "@/styles.css?raw";
import button from "@/components/ui/button.tsx?raw";
import appShell from "@/components/app-shell.tsx?raw";

describe("P24a superficies elevadas", () => {
  it("invierte fondo y tarjetas claros y conserva los oscuros", () => {
    const root = styles.match(/:root\s*\{([^}]+)\}/i)?.[1];
    const dark = styles.match(/\.dark\s*\{([^}]+)\}/i)?.[1];
    expect(root).toMatch(/--background:\s*#f8fafc\s*;/i);
    expect(root).toMatch(/--card:\s*#ffffff\s*;/i);
    expect(dark).toMatch(/--background:\s*#0f172a\s*;/i);
    expect(dark).toMatch(/--card:\s*#1e293b\s*;/i);
  });

  it("elimina las referencias a sombras anteriores", () => {
    expect(styles).not.toMatch(/neo-/i);
    expect(button).not.toMatch(/neo-/i);
  });

  it("registra las cuatro sombras en el tema de Tailwind", () => {
    const theme = styles.match(/@theme\s+inline\s*\{([^}]+)\}/i)?.[1];
    for (const name of ["card", "raised", "pressed", "flotante"]) {
      expect(theme).toMatch(new RegExp(`--shadow-${name}:\\s*var\\(--sombra-${name}\\)\\s*;`, "i"));
    }
  });

  it.each(["accion", "premium"])("btn-%s no tiñe su sombra", (name) => {
    const utility = styles.match(new RegExp(`@utility\\s+btn-${name}\\s*\\{([^}]+)\\}`, "i"))?.[1];
    expect(utility).toBeDefined();
    expect(utility).toContain("var(--sombra-raised)");
    expect(utility).not.toMatch(/color-mix\(in oklab, var\(--(?:accent|primary)\)/i);
  });

  it("Caja flotante conserva acción, sombra y anillo", () => {
    const destacado = appShell.match(/item\.destacado\s*&&\s*"([^"]+)"/i)?.[1];
    expect(destacado?.split(/\s+/)).toEqual(expect.arrayContaining(["btn-accion", "shadow-flotante", "ring-4", "ring-background"]));
  });
});