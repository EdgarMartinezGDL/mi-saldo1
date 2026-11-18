import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { PaginaNoEncontrada } from "@/components/pagina-no-encontrada";
import { logout } from "@/lib/api/auth";
import { rolPermitido, sitioActual, type TipoSitio } from "@/lib/sitio";

export function AvisoSitio({ sitio, onEntendido }: { sitio: TipoSitio; onEntendido: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 ring-1 ring-border">
        <h1 className="text-2xl font-semibold tracking-tight">{sitio === "admin" ? "Panel de Staff" : "Acceso de Staff"}</h1>
        <p className="mt-2 text-muted-foreground">{sitio === "admin"
          ? "Este panel es solo para el equipo de Staff de Mi Saldo Vip. Para usar tu cuenta, entra desde la app de Mi Saldo Vip."
          : "El panel de Staff se abre desde su dirección de administración."}</p>
        <Button size="lg" className="mt-5 w-full" onClick={onEntendido}>Entendido</Button>
      </div>
    </div>
  );
}

const PUBLICAS_CLIENTE = new Set(["/registro", "/bienvenida", "/activar", "/invitacion", "/confirmar-alta", "/baja"]);

/** Client-only presentation boundary: never replaces the server's authorization. */
export function GuardaSitio({ children }: { children: ReactNode }) {
  const sitio = sitioActual();
  const { estado, sesion } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const saliendo = useRef(false);
  const [aviso, setAviso] = useState<TipoSitio | null>(null);
  const incompatible = estado === "autenticado" && !!sesion && !rolPermitido(sitio, sesion.contexto.rol);
  const noExiste = (sitio === "publico" && pathname.startsWith("/staff")) ||
    (sitio === "admin" && PUBLICAS_CLIENTE.has(pathname.replace(/\/$/, "")));

  useEffect(() => {
    if (!incompatible || saliendo.current) return;
    saliendo.current = true;
    setAviso(sitio);
    void logout().catch(() => undefined);
  }, [incompatible, sitio]);

  useEffect(() => {
    if (sitio !== "admin" || pathname !== "/" || incompatible || aviso) return;
    if (estado === "autenticado" || estado === "anonimo") {
      void navigate({ to: estado === "autenticado" ? "/staff" : "/login", replace: true });
    }
  }, [sitio, pathname, incompatible, aviso, estado, navigate]);

  if (noExiste) return <PaginaNoEncontrada />;
  if (aviso || incompatible) return <AvisoSitio sitio={aviso ?? sitio} onEntendido={() => {
    setAviso(null);
    void navigate({ to: "/login", replace: true });
  }} />;
  if (sitio === "admin" && pathname === "/") return <p className="p-6 text-center text-muted-foreground">Cargando…</p>;
  return <>{children}</>;
}