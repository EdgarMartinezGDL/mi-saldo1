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
export const DEFAULT_PRIMARY = "#45c4b8";

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

function readableForeground(hex: string) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#ffffff";
  const channels = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance =
    0.2126 * lin(channels[0] ?? 0) + 0.7152 * lin(channels[1] ?? 0) + 0.0722 * lin(channels[2] ?? 0);
  return luminance > 0.45 ? "#17231f" : "#ffffff";
}

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
      root.style.setProperty("--primary", customColor);
      root.style.setProperty("--primary-foreground", readableForeground(customColor));
      root.style.setProperty("--ring", customColor);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
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
