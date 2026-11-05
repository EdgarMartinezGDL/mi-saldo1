import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AppShell, roleHome } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import type { Rol } from "@/lib/api/client";
import { PantallaSinConexion } from "@/components/sin-conexion";
import { MarcaMiSaldo } from "@/components/marca";
import { Skeleton } from "@/components/ui/skeleton";

/** Neutral full-screen loader: no app bar, no business name, no menu. */
function CargaNeutra() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
      <p className="text-2xl font-semibold tracking-tight"><MarcaMiSaldo /></p>
      <p className="text-muted-foreground">Cargando…</p>
    </div>
  );
}

/** Sends anonymous visitors to /login (returning here afterwards); shows a notice when the role can't use this screen. */
export function RequiereSesion({ titulo, roles, children }: { titulo: string; roles: Rol[]; children: ReactNode }) {
  const { estado, sesion } = useAuth();
  const navigate = useNavigate();
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const anonimo = estado === "anonimo";

  useEffect(() => {
    if (anonimo && pathname !== "/login" && !pathname.startsWith("/login/")) {
      void navigate({ to: "/login", search: { volver: pathname + (searchStr ?? "") }, replace: true });
    }
  }, [anonimo, navigate, pathname, searchStr]);

  if (estado === "sin_conexion") return <PantallaSinConexion />;
  if (estado === "comprobando" || anonimo || !sesion) return <CargaNeutra />;

  if (!roles.includes(sesion.contexto.rol)) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="mt-2 text-muted-foreground">Esta pantalla no está disponible con tu acceso actual.</p>
          <Button asChild size="lg" className="mt-5 w-full sm:w-auto"><Link to={roleHome(sesion.contexto.rol)}>Ir a mi inicio</Link></Button>
        </div>
      </AppShell>
    );
  }
  return <>{children}</>;
}

/** Animated skeleton blocks for loading sections; screen readers still hear "Cargando…". */
export function Cargando({ forma = "lista", filas = 3 }: { forma?: "lista" | "tarjetas"; filas?: number }) {
  return (
    <div role="status" aria-live="polite" className="py-2">
      <span className="sr-only">Cargando…</span>
      {forma === "tarjetas" ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
