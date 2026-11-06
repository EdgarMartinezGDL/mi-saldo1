import { describe, expect, it } from "vitest";
import manifestRaw from "../../public/manifest.webmanifest?raw";
import rootRaw from "@/routes/__root.tsx?raw";
import promocionesRaw from "@/routes/negocio.promociones.tsx?raw";

describe("P25b íconos de la app con el logo de Mi Saldo Vip", () => {
  it("el manifest tiene exactamente los 2 íconos nuevos (any y maskable)", () => {
    const manifest = JSON.parse(manifestRaw) as { icons: Array<Record<string, string>> };
    expect(manifest.icons).toEqual([
      { src: "/icons/mi-saldo-vip-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/mi-saldo-vip-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("__root.tsx enlaza el ícono nuevo y el apple-touch-icon maskable", () => {
    expect(rootRaw).toContain('/icons/mi-saldo-vip-512.png');
    expect(rootRaw).toContain('{ rel: "apple-touch-icon", href: "/icons/mi-saldo-vip-maskable-512.png" }');
  });

  it("la vista previa de Promociones usa el ícono nuevo", () => {
    expect(promocionesRaw).toContain('src="/icons/mi-saldo-vip-512.png"');
  });

  it("ningún archivo de src/ conserva el logo verde anterior", () => {
    const archivos = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [ruta, contenido] of Object.entries(archivos)) {
      if (ruta.endsWith("p25b.test.ts")) continue;
      expect(contenido, ruta).not.toContain("icon-512.png");
      expect(contenido, ruta).not.toContain("favicon.png");
      expect(contenido, ruta).not.toContain("favicon.ico");
    }
  });
});
