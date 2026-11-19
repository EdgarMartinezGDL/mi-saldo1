type ColoresFondo = {
  background: string; card: string; secondary: string; "muted-foreground": string;
  border: string; input: string; separador: string; casilla: string; "casilla-borde": string; esqueleto: string;
};

/** Fixed, contrast-tested device palettes; the two original modes inherit CSS. */
export const FONDOS = [
  { id: "blanco", nombre: "Blanco", modo: "claro", colores: null, background: "#f8fafc", card: "#ffffff", secondary: "#f1f5f9" },
  { id: "crema", nombre: "Crema", modo: "claro", colores: { background: "#faf6ee", card: "#ffffff", secondary: "#f2ecdf", "muted-foreground": "#665c48", border: "#e6dece", input: "#cfc4ad", separador: "#d9cfba", casilla: "#f2ecdf", "casilla-borde": "#cfc4ad", esqueleto: "#e6dece" } },
  { id: "menta", nombre: "Menta", modo: "claro", colores: { background: "#eff8f4", card: "#ffffff", secondary: "#dff0e8", "muted-foreground": "#4b6157", border: "#d3e6dd", input: "#b5d1c4", separador: "#c4ddd1", casilla: "#dff0e8", "casilla-borde": "#b5d1c4", esqueleto: "#d3e6dd" } },
  { id: "lavanda", nombre: "Lavanda", modo: "claro", colores: { background: "#f5f3fc", card: "#ffffff", secondary: "#e9e5f8", "muted-foreground": "#5c5675", border: "#dcd7f0", input: "#c3bbe3", separador: "#cfc8ec", casilla: "#e9e5f8", "casilla-borde": "#c3bbe3", esqueleto: "#dcd7f0" } },
  { id: "rosa", nombre: "Rosa", modo: "claro", colores: { background: "#fcf3f5", card: "#ffffff", secondary: "#f7e4e9", "muted-foreground": "#6b525c", border: "#eed6dd", input: "#dcb9c3", separador: "#e6c8d0", casilla: "#f7e4e9", "casilla-borde": "#dcb9c3", esqueleto: "#eed6dd" } },
  { id: "azul-noche", nombre: "Azul noche", modo: "oscuro", colores: null, background: "#0f172a", card: "#1e293b", secondary: "#334155" },
  { id: "carbon", nombre: "Carbón", modo: "oscuro", colores: { background: "#121212", card: "#1f1f1f", secondary: "#2e2e2e", "muted-foreground": "#a3a3a3", border: "#2e2e2e", input: "#4a4a4a", separador: "#2e2e2e", casilla: "#121212", "casilla-borde": "#4a4a4a", esqueleto: "#2e2e2e" } },
  { id: "bosque", nombre: "Bosque", modo: "oscuro", colores: { background: "#0c1d18", card: "#16302a", secondary: "#22443b", "muted-foreground": "#a3c2b7", border: "#22443b", input: "#36604f", separador: "#22443b", casilla: "#0c1d18", "casilla-borde": "#36604f", esqueleto: "#22443b" } },
  { id: "vino", nombre: "Vino", modo: "oscuro", colores: { background: "#1d0e13", card: "#2e1820", secondary: "#43242f", "muted-foreground": "#c9a9b4", border: "#43242f", input: "#66394a", separador: "#43242f", casilla: "#1d0e13", "casilla-borde": "#66394a", esqueleto: "#43242f" } },
  { id: "morado", nombre: "Morado", modo: "oscuro", colores: { background: "#151129", card: "#231d3f", secondary: "#342c57", "muted-foreground": "#b0a9d1", border: "#342c57", input: "#4f4580", separador: "#342c57", casilla: "#151129", "casilla-borde": "#4f4580", esqueleto: "#342c57" } },
] as const satisfies readonly { id: string; nombre: string; modo: "claro" | "oscuro"; colores: ColoresFondo | null; background?: string; card?: string; secondary?: string }[];

export type FondoId = typeof FONDOS[number]["id"];
export const DEFAULT_FONDO: FondoId = "azul-noche";
export const VARIABLES_FONDO = ["background", "card", "popover", "secondary", "muted", "muted-foreground", "border", "input", "separador", "casilla", "casilla-borde", "esqueleto"] as const;
export function obtenerFondo(id: unknown) {
  return FONDOS.find((f) => f.id === id) ?? FONDOS[5];
}