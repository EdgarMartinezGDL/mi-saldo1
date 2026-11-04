import { Link, useRouterState } from "@tanstack/react-router";
import {
  BadgeDollarSign,
  BarChart3,
  Gift,
  History,
  Home,
  ArrowLeft,
  UserRound,
  ShieldCheck,
  Users,
  LogOut,
  Receipt,
  Store,
  UserCheck,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { MarcaMiSaldo } from "@/components/marca";
import logoMarca from "@/assets/mi-saldo-vip-logo.png.asset.json";
import { useCerrarSesion } from "@/components/cerrar-sesion";
import { useMiSaldo } from "@/components/misaldo-provider";
import { useMisNegocios } from "@/components/mis-negocios";
import { useMisValidaciones } from "@/lib/use-mis-validaciones";
import type { Role } from "@/lib/misaldo-data";
import { cn } from "@/lib/utils";
import { AvisoPendiente } from "@/components/aviso-pendiente";

type NavItem = { to: string; label: string; icon: LucideIcon; destacado?: boolean };

export const NAV: Record<Role, NavItem[]> = {
  cliente: [
    { to: "/", label: "Inicio", icon: Home },
    { to: "/canjear", label: "Mis códigos", icon: Gift },
    { to: "/historial", label: "Historial", icon: History },
    { to: "/ajustes", label: "Cuenta", icon: UserRound },
  ],
  empleado: [
    { to: "/corte", label: "Mi jornada", icon: Receipt },
    { to: "/caja", label: "Caja", icon: BadgeDollarSign, destacado: true },
    { to: "/ajustes", label: "Cuenta", icon: UserRound },
  ],
  dueno: [
    { to: "/panel", label: "Inicio", icon: BarChart3 },
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/caja", label: "Caja", icon: BadgeDollarSign, destacado: true },
    { to: "/negocio", label: "Negocio", icon: Store },
    { to: "/ajustes", label: "Cuenta", icon: UserRound },
  ],
  staff: [
    { to: "/staff", label: "Staff", icon: ShieldCheck },
    { to: "/ajustes", label: "Cuenta", icon: UserRound },
  ],
};

/** Screens outside the bar highlight their parent tab. */
const PADRE: Record<string, string> = {
  "/reclamaciones": "/ajustes",
  "/referidos": "/ajustes",
  "/baja": "/ajustes",
  "/eliminar-cuenta": "/ajustes",
  "/empleados": "/negocio",
  "/negocio/movimientos": "/negocio",
  "/negocio/reclamaciones": "/negocio",
  "/negocio/solicitudes": "/negocio",
  "/negocio/horarios": "/negocio",
  "/negocio/referidos": "/negocio",
  "/negocio/reportes": "/negocio",
};

/** Fixed home per role; independent of the menu order (Caja sits in the middle). */
const HOME: Record<Role, string> = {
  cliente: "/",
  empleado: "/caja",
  dueno: "/panel",
  staff: "/staff",
};

export function roleHome(role: Role) {
  return HOME[role] ?? "/";
}

/** Shortcut to /validaciones with a pending counter; shown for any signed-in profile. */
function AccesoValidaciones() {
  const { estado } = useAuth();
  const { data } = useMisValidaciones();
  const pendientes = data?.validaciones?.filter((v) => v.estado === "pendiente").length ?? 0;
  if (estado !== "autenticado") return null;
  return (
    <Link
      to="/validaciones"
      aria-label={pendientes ? `Solicitudes por confirmar: ${pendientes}` : "Solicitudes por confirmar"}
      className="tap-target relative grid size-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      <UserCheck className="size-5" />
      {pendientes > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
          {pendientes}
        </span>
      )}
    </Link>
  );
}

function AppBar() {
  const { business } = useMiSaldo();
  const { sesion } = useAuth();
  const { abrir, varios, dialogo } = useMisNegocios();
  const rol = sesion?.contexto.rol;
  const nombre = rol && rol !== "staff" && sesion?.contexto.nombre_comercial ? sesion.contexto.nombre_comercial : null;
  const logo = nombre ? business.logo : undefined;
  const initials = (nombre ?? "")
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-barra bg-barra text-barra-foreground">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {nombre ? (
            logo ? (
              <img
                src={logo}
                alt=""
                className="size-11 shrink-0 rounded-full object-cover ring-1 ring-white/30"
              />
            ) : (
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 text-base font-bold text-white ring-1 ring-white/30">
                {initials || "MS"}
              </div>
            )
          ) : (
            <img src={logoMarca.url} alt="Mi Saldo Vip" className="h-9 w-auto shrink-0 rounded-lg" />
          )}
          <div className="min-w-0 leading-tight">
            {nombre ? (
              <>
                {varios ? (
                  <button
                    type="button"
                    onClick={abrir}
                    aria-label={`${nombre}. Cambiar de negocio`}
                    className="flex max-w-full items-center gap-1 rounded-lg text-left text-lg font-bold text-white hover:text-white/80"
                  >
                    <span className="truncate">{nombre}</span>
                    <ChevronDown className="size-5 shrink-0" />
                  </button>
                ) : (
                  <p className="truncate text-lg font-bold text-white">{nombre}</p>
                )}
                <p className="truncate text-[11px] text-white/80">
                  <MarcaMiSaldo /> · By MicroFix Cloud
                </p>
              </>
            ) : (
              <p className="truncate text-lg font-bold text-white">
                <MarcaMiSaldo />
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AccesoValidaciones />
        </div>
      </div>
      {dialogo}
    </header>
  );
}

export function AppShell({ children, volver, volverTexto, amplio = false }: { children: ReactNode; volver?: string; volverTexto?: string; amplio?: boolean }) {
  const { estado, sesion } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = sesion ? NAV[sesion.contexto.rol] : [];
  const padre = PADRE[path] ?? (path.startsWith("/negocio/") ? "/negocio" : undefined);
  const activo = padre ?? path;
  const atras = volver ?? padre;
  const textoAtras = volverTexto ?? (atras === "/negocio" ? "Negocio" : "Volver");
  const { pedirConfirmacion, dialogo } = useCerrarSesion();
  const autenticado = estado === "autenticado";

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar />
      {autenticado && <AvisoPendiente />}
      {dialogo}
      <div className={cn("mx-auto flex w-full flex-1 gap-6 px-0 md:px-4", amplio ? "max-w-7xl" : "max-w-5xl")}>
        <aside className="sticky top-20 hidden h-fit w-60 shrink-0 flex-col gap-1 py-6 md:flex">
          {items.map((item) => {
            const active = activo === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors",
                  active
                    ? "btn-premium text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:shadow-soft",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          {autenticado && (
            <div className="mt-4 border-t border-border pt-4">
              <button
                type="button"
                onClick={pedirConfirmacion}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-5 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          )}
        </aside>
        <main className="w-full flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-5 md:px-0 md:pb-10">
          {atras && (
            <Link
              to={atras}
              className="tap-target mb-4 inline-flex items-center gap-2 rounded-xl px-3 text-base font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-5" /> {textoAtras}
            </Link>
          )}
          {children}
        </main>
      </div>
      <nav className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegación principal">
        <div
          className="mx-auto grid max-w-md px-2"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active = activo === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[64px] flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground/80 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-colors",
                    active && !item.destacado && "bg-primary/12",
                    item.destacado && "btn-premium -mt-7 size-16 text-primary-foreground ring-4 ring-background",
                  )}
                >
                  <item.icon className={cn("shrink-0", item.destacado ? "size-7" : "size-[22px]")} strokeWidth={active ? 2.2 : 1.7} />
                </span>
                <span className={cn("text-[11px] tracking-tight", active || item.destacado ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
                {!item.destacado && (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1 rounded-full bg-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
