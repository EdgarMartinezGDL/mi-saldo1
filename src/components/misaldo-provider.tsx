import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "@/lib/misaldo-data";

export type ThemeMode = "claro" | "oscuro" | "personalizado";

export const DEFAULT_THEME: ThemeMode = "oscuro";
export const DEFAULT_PRIMARY = "#2563EB";

/** WCAG relative luminance for hexadecimal theme colors. */
function luminancia(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(channels[0] ?? 0) + 0.7152 * lin(channels[1] ?? 0) + 0.0722 * lin(channels[2] ?? 0);
}
function contraste(a: string, b: string) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function ajustarLuminosidad(hex: string, fondo: string, aclarar: boolean) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  const h = delta === 0 ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  let color = hex;
  for (let paso = 1; paso <= 50 && contraste(color, fondo) < 4.5; paso++) {
    const luz = Math.max(0, Math.min(1, l + (aclarar ? 1 : -1) * paso * 0.02));
    const c = (1 - Math.abs(2 * luz - 1)) * sat;
    const x = c * (1 - Math.abs(h % 2 - 1)), m = luz - c / 2;
    const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    color = "#" + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  return color;
}

/** Adjust only theme colors that need it to meet WCAG AA. */
export function colorConContraste(hex: string) {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : DEFAULT_PRIMARY;
  if (contraste(color, "#ffffff") >= 4.5) return { fondo: color, texto: "#ffffff" };
  if (luminancia(color) > 0.45 && contraste(color, "#1E293B") >= 4.5) return { fondo: color, texto: "#1E293B" };
  return { fondo: ajustarLuminosidad(color, "#ffffff", false), texto: "#ffffff" };
}

export function colorTextoConContraste(hex: string, tarjeta: string) {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : DEFAULT_PRIMARY;
  return ajustarLuminosidad(color, tarjeta, luminancia(tarjeta) < 0.45);
}

type Business = {
  name: string;
  branch: string;
  logo: string | null;
  stampsRequired: number;
  pointsPerPeso: number;
};

type MiSaldoState = {
  role: Role;
  setRole: (role: Role) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  customColor: string;
  setCustomColor: (hex: string) => void;
  restoreDefaultColors: () => void;
  resetSessionData: () => void;
  business: Business;
  updateBusiness: (patch: Partial<Business>) => void;
};

const MiSaldoContext = createContext<MiSaldoState | null>(null);

const STORAGE_KEY = "misaldo-prefs";

export function MiSaldoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("cliente");
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [customColor, setCustomColor] = useState(DEFAULT_PRIMARY);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [business, setBusiness] = useState<Business>({
    name: "Taquería La Cuna",
    branch: "Sucursal Centro",
    logo: null,
    stampsRequired: 10,
    pointsPerPeso: 1,
  });

  // Read stored prefs after hydration to avoid SSR mismatches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        theme: ThemeMode;
        customColor: string;
      }>;
      if (saved.theme) setTheme(saved.theme);
      if (saved.customColor) setCustomColor(saved.customColor);
    } catch {
      /* ignore corrupted prefs */
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, customColor }));
    } catch {
      /* storage unavailable */
    }
  }, [theme, customColor, preferencesReady]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme !== "claro");
    if (theme === "personalizado") {
      const color = colorConContraste(customColor);
      root.style.setProperty("--primary", color.fondo);
      root.style.setProperty("--primary-foreground", color.texto);
      root.style.setProperty("--primary-texto", colorTextoConContraste(customColor, "#1e293b"));
      root.style.setProperty("--primary-etiqueta", colorTextoConContraste(customColor, "#3f423e"));
      root.style.setProperty("--primary-aviso", colorTextoConContraste(customColor, "#3f423e"));
      root.style.setProperty("--ring", customColor);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--primary-texto");
      root.style.removeProperty("--primary-etiqueta");
      root.style.removeProperty("--primary-aviso");
      root.style.removeProperty("--ring");
    }
  }, [theme, customColor]);

  const updateBusiness = useCallback((patch: Partial<Business>) => {
    setBusiness((prev) => ({ ...prev, ...patch }));
  }, []);

  const restoreDefaultColors = useCallback(() => {
    setCustomColor(DEFAULT_PRIMARY);
    setTheme(DEFAULT_THEME);
  }, []);

  /** Clears business/role left by the previous session; keeps theme and color. */
  const resetSessionData = useCallback(() => {
    setRole("cliente");
    setBusiness((b) => ({ ...b, name: "MiSaldo", branch: "", logo: null }));
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole,
      theme,
      setTheme,
      customColor,
      setCustomColor,
      restoreDefaultColors,
      resetSessionData,
      business,
      updateBusiness,
    }),
    [role, theme, customColor, business, updateBusiness, restoreDefaultColors, resetSessionData],
  );

  return <MiSaldoContext.Provider value={value}>{children}</MiSaldoContext.Provider>;
}

const FALLBACK: MiSaldoState = {
  role: "cliente",
  setRole: () => {},
  theme: "oscuro",
  setTheme: () => {},
  customColor: DEFAULT_PRIMARY,
  setCustomColor: () => {},
  restoreDefaultColors: () => {},
  resetSessionData: () => {},
  business: {
    name: "Taquería La Cuna",
    branch: "Sucursal Centro",
    logo: null,
    stampsRequired: 10,
    pointsPerPeso: 1,
  },
  updateBusiness: () => {},
};

/**
 * Never throws: screens rendered outside the provider (error/not-found shells,
 * stale HMR trees) degrade to read-only defaults instead of blanking the app.
 */
export function useMiSaldo() {
  return useContext(MiSaldoContext) ?? FALLBACK;
}
