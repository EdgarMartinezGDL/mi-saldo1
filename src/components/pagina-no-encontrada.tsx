import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { roleHome } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { MarcaMiSaldo } from "@/components/marca";

export function PaginaNoEncontrada() {
  const { estado, sesion } = useAuth();
  useEffect(() => { document.title = "Página no encontrada · Mi Saldo Vip"; }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="shadow-soft w-full max-w-sm rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-border sm:px-8">
        <p className="font-mono text-lg font-bold tracking-tight text-primary"><MarcaMiSaldo /></p>
        <h1 className="mt-4 text-6xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">La página que buscas no existe o cambió de dirección.</p>
        <div className="mt-8">
          {estado === "comprobando" ? <Button size="lg" disabled>Cargando…</Button> :
            <Button size="lg" asChild><Link to={sesion ? roleHome(sesion.contexto.rol) : "/login"}>Ir al inicio</Link></Button>}
        </div>
      </div>
    </div>
  );
}