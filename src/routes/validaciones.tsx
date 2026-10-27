import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Alerta, CampoDigitos, fechaLarga } from "@/components/enlace-ui";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/client";
import {
  confirmarMiValidacion, rechazarMiValidacion,
  textoEstado, textoResultado, textoSolicitud, type Validacion,
} from "@/lib/api/enlaces";
import { useMisValidaciones, useResolverValidacionEnCache } from "@/lib/use-mis-validaciones";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

export const Route = createFileRoute("/validaciones")({
  head: () => ({
    meta: [
      { title: "Validaciones · MiSaldo" },
      { name: "description", content: "Consulta tus validaciones pendientes en MiSaldo." },
      { property: "og:title", content: "Validaciones · MiSaldo" },
      { property: "og:description", content: "Consulta tus validaciones pendientes en MiSaldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Validaciones,
});

function Validaciones() {
  const { estado } = useAuth();
  const navigate = useNavigate();
  const { data, error: errorQuery, isPending } = useMisValidaciones();
  const [aviso, setAviso] = useState<string | null>(null);

  const irALogin = useCallback(
    () => navigate({ to: "/login", search: { volver: "/validaciones" }, replace: true }),
    [navigate],
  );

  useEffect(() => {
    if (estado === "anonimo") irALogin();
  }, [estado, irALogin]);

  useEffect(() => {
    if (errorQuery instanceof ApiError && errorQuery.status === 401) irALogin();
  }, [errorQuery, irALogin]);

  const lista = data?.validaciones ?? null;
  const error =
    errorQuery && !(errorQuery instanceof ApiError && errorQuery.status === 401)
      ? errorQuery instanceof ApiError
        ? errorQuery.message
        : "No se pudo cargar."
      : null;

  const pendientes = lista?.filter((v) => v.estado === "pendiente") ?? [];
  const resueltas = lista?.filter((v) => v.estado !== "pendiente") ?? [];

  const mostrarAviso = (mensaje: string) => {
    setAviso(mensaje);
    setTimeout(() => setAviso(null), 2500);
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Solicitudes por confirmar</h1>
      <p className="mt-1 text-muted-foreground">Negocios que quieren registrarte con tu teléfono.</p>
      <div className="mt-5 flex flex-col gap-4">
        {aviso && <Alerta tono="ok">{aviso}</Alerta>}
        {error && <Alerta>{error}</Alerta>}
        {isPending && !error && <Cargando />}
        {lista && pendientes.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-border">No tienes solicitudes por confirmar.</p>
        )}
        {pendientes.map((v) => <Pendiente key={v.validacion_id} v={v} onSesionCerrada={irALogin} onResuelta={mostrarAviso} />)}
        {resueltas.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-lg font-semibold">Anteriores</h2>
            <ul className="flex flex-col gap-2">
              {resueltas.map((v) => (
                <li key={v.validacion_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                  <p className="font-medium">{textoSolicitud(v)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{textoEstado[v.estado]}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Pendiente({ v, onResuelta, onSesionCerrada }: { v: Validacion; onResuelta: (mensaje: string) => void; onSesionCerrada: () => void }) {
  const resolverEnCache = useResolverValidacionEnCache();
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmaNo, setConfirmaNo] = useState(false);
  const refPin = useDesplazarAlAbrir(pidiendoPin, true);

  const correr = async (fn: () => ReturnType<typeof rechazarMiValidacion>) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fn();
      resolverEnCache(v.validacion_id, r);
      onResuelta(textoResultado(r, v.negocio.nombre_comercial));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSesionCerrada();
      if (e instanceof ApiError && e.codigo === "pin_incorrecto") {
        const n = e.extras["intentos_restantes"];
        setError(typeof n === "number" ? (n === 1 ? "PIN incorrecto, te queda 1 intento." : `PIN incorrecto, te quedan ${n} intentos.`) : "PIN incorrecto.");
        setPin("");
      } else setError(e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <article className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <p className="text-lg font-medium">{textoSolicitud(v)}.</p>
      <p className="mt-1 text-sm text-muted-foreground">Vence el {fechaLarga(v.expira_en)}</p>
      <div className="mt-4 flex flex-col gap-3">
        {error && <Alerta>{error}</Alerta>}
        {pidiendoPin ? (
          <div ref={refPin} className="flex flex-col gap-3">
            <CampoDigitos etiqueta="Escribe tu PIN para confirmar" valor={pin} onChange={setPin} largo={6} limite={128} activo onActivar={() => {}} />
            <Button size="lg" disabled={cargando || pin.length < 4 || pin.length > 128}
              onClick={() => void correr(() => confirmarMiValidacion(v.validacion_id, pin))}>
              {cargando ? "Confirmando…" : "Confirmar"}
            </Button>
            <Button variant="link" onClick={() => { setPidiendoPin(false); setPin(""); }}>Cancelar</Button>
          </div>
        ) : (
          <>
            <Button size="lg" disabled={cargando} onClick={() => setPidiendoPin(true)}>Sí, soy yo</Button>
            <Button size="lg" variant="outline" disabled={cargando}
              onClick={() => setConfirmaNo(true)}>No soy yo</Button>
            <AlertDialog open={confirmaNo} onOpenChange={setConfirmaNo}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Seguro que no eres tú?</AlertDialogTitle>
                  <AlertDialogDescription>{v.negocio.nombre_comercial} no te va a registrar y le avisaremos a MiSaldo para revisarlo.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cargando}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={cargando}
                    onClick={() => { setConfirmaNo(false); void correr(() => rechazarMiValidacion(v.validacion_id)); }}>No soy yo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </article>
  );
}
