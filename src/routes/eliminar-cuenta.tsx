import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, setSesion } from "@/lib/api/client";
import { pesos } from "@/lib/api/formato";
import { eliminarCuenta, vistaEliminacion, type VistaEliminacion } from "@/lib/api/recuperacion";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/eliminar-cuenta")({
  head: () => ({
    meta: [
      { title: "Eliminar mi cuenta · MiSaldo" },
      { name: "description", content: "Revisa lo que pierdes antes de eliminar tu cuenta de MiSaldo en todos tus negocios." },
      { property: "og:title", content: "Eliminar mi cuenta · MiSaldo" },
      { property: "og:description", content: "Eliminación definitiva de tu cuenta de MiSaldo, con vista previa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EliminarCuenta,
});

const ROLES = { dueno: "dueño", empleado: "empleado", staff: "Staff" } as const;

function EliminarCuenta() {
  const [hecha, setHecha] = useState(false);
  const refHecha = useDesplazarAlAbrir(hecha);
  if (hecha) {
    return (
      <AppShell>
        <div ref={refHecha} className="rounded-2xl bg-card p-6 ring-1 ring-border">
          <h1 className="text-2xl font-semibold tracking-tight">Tu cuenta quedó eliminada</h1>
          <p className="mt-2 text-muted-foreground">Te enviamos un comprobante por WhatsApp y correo.</p>
          <Button asChild className="mt-4"><Link to="/login">Ir al inicio</Link></Button>
        </div>
      </AppShell>
    );
  }
  return (
    <RequiereSesion titulo="Eliminar mi cuenta" roles={["cliente"]}>
      <Formulario onHecha={() => setHecha(true)} />
    </RequiereSesion>
  );
}

function Formulario({ onHecha }: { onHecha: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [vista, setVista] = useState<VistaEliminacion | null>(null);
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const refForm = useDesplazarAlAbrir(vista, true);

  useEffect(() => {
    vistaEliminacion().then(setVista).catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar."));
  }, []);

  const eliminar = async () => {
    setEnviando(true);
    try {
      await eliminarCuenta(pin);
      onHecha();
      setSesion(null);
      queryClient.clear();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 401) {
        setSesion(null);
        queryClient.clear();
        void navigate({ to: "/login", replace: true });
        return;
      }
      if (err?.codigo === "tiene_otros_roles") {
        const otros = err.extras["otros_roles"];
        setVista((v) => (v ? { ...v, puede_eliminarse: false, otros_roles: Array.isArray(otros) ? (otros as VistaEliminacion["otros_roles"]) : v.otros_roles } : v));
      }
      const r = err?.extras["intentos_restantes"];
      toast.error(err?.codigo === "pin_incorrecto" ? "PIN incorrecto" : err?.message ?? "No se pudo eliminar tu cuenta.", {
        description: typeof r === "number" ? (r === 1 ? "Te queda 1 intento." : `Te quedan ${r} intentos.`) : undefined,
      });
      setPin("");
    } finally {
      setEnviando(false);
      setConfirmar(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Eliminar mi cuenta</h1>
        {!vista ? (
          <Cargando />
        ) : !vista.puede_eliminarse ? (
          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <p className="text-base">
              Tu cuenta también es de {vista.otros_roles.map((r) => ROLES[r]).join(" / ")} y no se puede eliminar desde aquí. Puedes darte de baja como
              cliente en cada negocio o escribir a soporte de MiSaldo.
            </p>
          </section>
        ) : (
          <section ref={refForm} className="rounded-2xl bg-card p-5 ring-1 ring-destructive/40">
            <p className="flex items-center gap-2 text-lg font-semibold text-destructive"><TriangleAlert className="size-5" /> Esto es lo que vas a perder</p>
            <ul className="mt-3 flex flex-col gap-4">
              {vista.negocios.map((n) => (
                <li key={n.negocio.negocio_id} className="text-sm text-destructive">
                  <p className="font-semibold">{n.negocio.nombre_comercial}</p>
                  <p>Saldo: {pesos(n.saldo_centavos)}</p>
                  {n.tarjetas.map((t) => (
                    <p key={t.tarjeta}>{t.tarjeta}: {plural(t.sellos_en_curso, "sello", "sellos")} en curso y {plural(t.premios_por_canjear, "premio", "premios")} por canjear</p>
                  ))}
                  {n.reclamaciones_pendientes > 0 && <p>{plural(n.reclamaciones_pendientes, "reclamación pendiente", "reclamaciones pendientes")}</p>}
                  {n.referidos_pendientes > 0 && <p>{plural(n.referidos_pendientes, "recomendación pendiente", "recomendaciones pendientes")}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Tu cuenta, tu teléfono y tu correo se borran de MiSaldo en todos tus negocios. No se puede deshacer.
            </p>
            <Input className="mt-3 h-12 text-center font-mono text-xl tracking-[0.4em]" type="password" inputMode="numeric" maxLength={128}
              placeholder="PIN" aria-label="Tu PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            <Button variant="destructive" size="lg" className="mt-4 h-auto min-h-12 w-full whitespace-normal" disabled={pin.length < 4 || enviando} onClick={() => setConfirmar(true)}>
              Sí, eliminar mi cuenta y perder todo
            </Button>
          </section>
        )}
        <AlertDialog open={confirmar} onOpenChange={(o) => !enviando && setConfirmar(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta para siempre?</AlertDialogTitle>
              <AlertDialogDescription>Pierdes tu saldo, sellos y premios en todos tus negocios. No se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={enviando} onClick={(e) => { e.preventDefault(); void eliminar(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {enviando ? "Eliminando…" : "Sí, eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
