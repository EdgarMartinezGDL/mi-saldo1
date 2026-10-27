import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronRight, Gift, LogOut, MessageSquareWarning, Moon, Palette, Sun } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { useAuth } from "@/components/auth-provider";
import { useCerrarSesion } from "@/components/cerrar-sesion";
import { Encabezado, MisDatos, Promociones, Seguridad, Tarjeta } from "@/components/cuenta/secciones";
import { useMisNegocios } from "@/components/mis-negocios";
import { useMiSaldo, type ThemeMode } from "@/components/misaldo-provider";
import { RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Cuenta · MiSaldo" },
      { name: "description", content: "Tus datos, tu PIN, tu correo, la apariencia de la app y tu sesión." },
      { property: "og:title", content: "Cuenta · MiSaldo" },
      { property: "og:description", content: "Administra tus datos personales, seguridad y apariencia en MiSaldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Cuenta" roles={["cliente", "empleado", "dueno", "staff"]}>
      <Cuenta />
    </RequiereSesion>
  ),
});

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "claro", label: "Claro", icon: Sun },
  { value: "oscuro", label: "Oscuro", icon: Moon },
  { value: "personalizado", label: "Personalizado", icon: Palette },
];

const PRESETS = ["#0b7a5e", "#7c3f2f", "#1d4ed8", "#b3261e", "#6b21a8", "#0f766e"];

const enlace = "tap-target flex min-h-14 items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-base font-medium shadow-soft hover:text-primary";

function Cuenta() {
  const { theme, setTheme, customColor, setCustomColor } = useMiSaldo();
  const { estado, sesion } = useAuth();
  const rol = sesion?.contexto.rol;
  const { pedirConfirmacion, dialogo } = useCerrarSesion();
  const negocios = useMisNegocios();
  const refCustom = useDesplazarAlAbrir(theme === "personalizado");

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Cuenta</h1>

        <Encabezado />
        <MisDatos />

        {negocios.varios && (
          <button type="button" onClick={negocios.abrir} className={enlace}>
            <ArrowLeftRight className="size-5 text-primary" />
            <span className="flex-1 text-left">Cambiar de negocio</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        )}

        {(rol === "dueno" || rol === "staff") && <Seguridad staff={rol === "staff"} />}

        {rol === "cliente" && (
          <>
            <Promociones />
            <div className="flex flex-col gap-2">
              <Link to="/referidos" className={enlace}>
                <Gift className="size-5 text-primary" />
                <span className="flex-1">Recomienda y gana</span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
              <Link to="/reclamaciones" className={enlace}>
                <MessageSquareWarning className="size-5 text-primary" />
                <span className="flex-1">Mis reclamaciones</span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </div>
          </>
        )}

        <Tarjeta titulo="Apariencia">
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                aria-pressed={theme === t.value}
                className={cn(
                  "tap-target flex min-h-20 flex-col items-start justify-center gap-1 rounded-2xl px-4 py-3 text-left transition-colors",
                  theme === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                )}
              >
                <t.icon className="size-6 shrink-0" />
                <span className="text-base font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
          {theme === "personalizado" && (
            <div ref={refCustom} className="mt-5 border-t border-border pt-5">
              <Label htmlFor="color" className="text-base">Color principal</Label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input id="color" type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="size-14 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent" />
                <Input value={customColor} onChange={(e) => setCustomColor(e.target.value)} aria-label="Color hexadecimal" className="h-14 w-40 font-mono text-base" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Usar color ${hex}`}
                    onClick={() => setCustomColor(hex)}
                    className={cn(
                      "size-11 shrink-0 rounded-xl ring-2 ring-offset-2 ring-offset-card transition-transform active:scale-95",
                      customColor.toLowerCase() === hex ? "ring-foreground" : "ring-transparent",
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </Tarjeta>

        {estado === "autenticado" && (
          <Button type="button" variant="destructive" size="lg" className="h-14 w-full text-base" onClick={pedirConfirmacion}>
            <LogOut className="size-5" />
            Cerrar sesión
          </Button>
        )}

        {rol === "cliente" && (
          <div className="mt-6 flex flex-col items-center border-t border-border pt-4 text-center">
            <Link to="/baja" className="tap-target inline-flex items-center rounded-xl px-4 py-3 text-sm text-muted-foreground hover:text-destructive">
              Darme de baja de este negocio
            </Link>
            <Link to="/eliminar-cuenta" className="tap-target inline-flex items-center rounded-xl px-4 py-3 text-xs text-muted-foreground hover:text-destructive">
              Eliminar mi cuenta de MiSaldo
            </Link>
          </div>
        )}

        {dialogo}
        {negocios.dialogo}
      </div>
    </AppShell>
  );
}
