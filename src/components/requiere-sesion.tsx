import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AppShell, roleHome } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import type { Rol } from "@/lib/api/client";
import { PantallaSinConexion } from "@/components/sin-conexion";

/** Neutral full-screen loader: no app bar, no business name, no menu. */
function CargaNeutra() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
      <p className="text-2xl font-semibold tracking-tight">MiSaldo</p>
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

/** Shared skeleton text for loading sections. */
export const Cargando = () => <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>;
