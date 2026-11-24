import { describe, expect, it } from "vitest";

// P46b (2026-11-23): los textos visibles dicen "PIN de acceso / acumulación / canje".
// Revisa el código fuente (sin las pruebas): nombres de campos de la API como
// `codigo_canje` no cuentan, solo el texto en español.
const fuentes = import.meta.glob(["../**/*.{ts,tsx}", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("Claude: nombres de los PIN (P46b)", () => {
  it("ningún texto dice 'código de canje' ni 'código de acumulación'", () => {
    expect(Object.keys(fuentes).length).toBeGreaterThan(50);
    const viejos = Object.entries(fuentes)
      .filter(([, texto]) => /c[oó]digo de (canje|acumulaci[oó]n)/i.test(texto))
      .map(([archivo]) => archivo);
    expect(viejos).toEqual([]);
  });

  it("la bienvenida nombra los dos PIN que nadie debe pedirte", () => {
    const texto = fuentes["../routes/bienvenida.tsx"];
    expect(texto).toContain("te pedirá tu PIN de acceso (6 dígitos) ni tu PIN de canje (4 dígitos) por mensaje o llamada.");
  });
});
