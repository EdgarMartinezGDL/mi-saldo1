import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { CampoPin, OjoSecreto } from "@/components/campo-pin";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/client";
import { guardarTelefonoPrellenado } from "@/lib/telefono-prellenado";
import { textoIntentos } from "@/lib/plural";
import { cambiarCodigos, verPinAcumulacion, verPinCanje, type PinCanjeConsultado } from "./cuenta-api";
import { useError } from "./secciones";

type EstadoPin = Omit<PinCanjeConsultado, "codigo_canje">;
type Modo = "ver" | "cambiar";
const digitos = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);

/** Secrets are local only; generation guards also discard late responses after hiding. */
export function TusPines({ telefono = "" }: { telefono?: string }) {
  const id = useId();
  const mostrarError = useError();
  const [acumulacion, setAcumulacion] = useState<string | null>(null);
  const [sinAcumulacion, setSinAcumulacion] = useState(false);
  const [canje, setCanje] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [estado, setEstado] = useState<EstadoPin | null>(null);
  const [modo, setModo] = useState<Modo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const generacion = useRef(0);

  const cerrar = () => { generacion.current++; setModo(null); };
  useEffect(() => {
    const ocultar = () => {
      if (document.visibilityState !== "hidden") return;
      generacion.current++; setAcumulacion(null); setCanje(null); setSegundos(0); setModo(null); setOcupado(false);
    };
    document.addEventListener("visibilitychange", ocultar);
    return () => { generacion.current++; document.removeEventListener("visibilitychange", ocultar); };
  }, []);
  useEffect(() => {
    if (!acumulacion) return;
    const timer = setTimeout(() => setAcumulacion(null), 30_000);
    return () => clearTimeout(timer);
  }, [acumulacion]);
  useEffect(() => {
    if (!canje) return;
    const fin = Date.now() + 30_000;
    const timer = setInterval(() => {
      const quedan = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setSegundos(quedan);
      if (!quedan) setCanje(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [canje]);

  const verAcumulacion = async () => {
    if (acumulacion) { setAcumulacion(null); return; }
    const actual = generacion.current;
    setOcupado(true);
    try {
      const r = await verPinAcumulacion();
      if (actual !== generacion.current) return;
      setAcumulacion(r.codigo_acumulacion); setSinAcumulacion(r.codigo_acumulacion === null);
    } catch (e) { if (actual === generacion.current) mostrarError(e); }
    finally { if (actual === generacion.current) setOcupado(false); }
  };

  return <section aria-labelledby={`${id}-titulo`} className="bg-card p-5 ring-1 ring-border rounded-lg">
    <h2 id={`${id}-titulo`} className="flex gap-2 items-center text-lg font-semibold"><KeyRound className="size-5 text-primary-texto" />Tus PINes</h2>
    <div className="mt-4 grid gap-4">
      <div>
        <p className="font-medium">PIN de acumulación (4 dígitos)</p>
        <div className="flex items-center justify-between gap-3 min-h-14">
          <p id={`${id}-acumulacion`} className="font-mono text-4xl font-bold tabular-nums">{acumulacion ?? "••••"}</p>
          <span aria-busy={ocupado}><OjoSecreto visible={!!acumulacion} etiqueta="PIN de acumulación" controls={`${id}-acumulacion`} onClick={() => { if (!ocupado) void verAcumulacion(); }} /></span>
        </div>
        {sinAcumulacion && <><p className="text-sm text-muted-foreground">Aún no tienes PIN de acumulación. No es obligatorio.</p><Button asChild variant="link" className="h-auto min-h-11 px-0 whitespace-normal text-left"><Link to="/canjear">Crear PIN de acumulación</Link></Button></>}
      </div>
      <div className="border-t border-border pt-4">
        <p className="font-medium">PIN de canje (4 dígitos)</p>
        <div className="flex items-center justify-between gap-3 min-h-14">
          <p id={`${id}-canje`} className="font-mono text-4xl font-bold tabular-nums">{canje ?? "••••"}</p>
          <OjoSecreto visible={!!canje} etiqueta="PIN de canje" controls={`${id}-canje`} onClick={() => { if (canje) { setCanje(null); setSegundos(0); } else setModo("ver"); }} />
        </div>
        {canje && <p className="text-sm text-muted-foreground">Se ocultará en {segundos} s</p>}
        {estado?.estado === "sin_copia" && <p className="text-sm text-muted-foreground">Por seguridad no podemos mostrar tu PIN de canje actual. Crea uno nuevo para poder verlo aquí.</p>}
        {estado?.estado === "sin_codigo" && <p className="text-sm text-muted-foreground">Aún no tienes PIN de canje.</p>}
        {estado?.codigo_canje_requiere_cambio && <p className="text-sm text-warn-texto">Tu PIN de canje se bloqueó por intentos fallidos. Cámbialo para volver a usarlo.</p>}
        {estado?.codigo_canje_bloqueado_hasta && <p className="text-sm text-warn-texto">Tu PIN de canje está bloqueado hasta las {new Date(estado.codigo_canje_bloqueado_hasta).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.</p>}
        <Button variant="secondary" className="mt-3 min-h-11 whitespace-normal" onClick={() => { setCanje(null); setSegundos(0); setModo("cambiar"); }}>{estado?.estado === "sin_codigo" ? "Crear PIN de canje" : "Cambiar PIN de canje"}</Button>
      </div>
      <p className="text-sm text-muted-foreground">Te recomendamos cambiar tu PIN de canje (4 dígitos) cada cierto tiempo y dictarlo solo al cajero al cobrar.</p>
    </div>
    {modo && <DialogoPin key={modo} modo={modo} telefono={telefono} cerrar={cerrar} vigente={() => generacion.current} completar={(r) => {
      const { codigo_canje, ...publico } = r;
      setEstado(publico); setCanje(r.estado === "disponible" ? codigo_canje : null); setSegundos(r.estado === "disponible" && codigo_canje ? 30 : 0); cerrar();
    }} cambiado={() => { setEstado(null); cerrar(); }} />}
  </section>;
}

function DialogoPin({ modo, telefono, cerrar, vigente, completar, cambiado }: {
  modo: Modo; telefono: string; cerrar: () => void; vigente: () => number;
  completar: (r: PinCanjeConsultado) => void; cambiado: () => void;
}) {
  const id = useId();
  const mostrarError = useError();
  const [pin, setPin] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [repite, setRepite] = useState("");
  const [error, setError] = useState("");
  const [intentos, setIntentos] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const esCambio = modo === "cambiar";
  const listo = pin.length === 6 && (!esCambio || (nuevo.length === 4 && repite === nuevo));
  const enviar = async () => {
    if (!listo || ocupado) return;
    const actual = vigente();
    setOcupado(true); setError(""); setIntentos(null);
    try {
      if (esCambio) {
        const r = await cambiarCodigos({ pin, codigo_canje: nuevo });
        if (!vivo.current || actual !== vigente()) return;
        toast.success("PIN de canje actualizado", { description: r.advertencias?.join(" ") || undefined }); cambiado();
      } else {
        const r = await verPinCanje(pin);
        if (vivo.current && actual === vigente()) completar(r);
      }
    } catch (e) {
      if (!vivo.current || actual !== vigente()) return;
      setPin("");
      if (e instanceof ApiError && e.status === 401) { cerrar(); mostrarError(e); }
      else if (e instanceof ApiError && e.codigo === "pin_incorrecto") {
        setError("Tu PIN de acceso (6 dígitos) es incorrecto");
        const n = e.extras["intentos_restantes"]; setIntentos(typeof n === "number" ? n : null);
      } else if (e instanceof ApiError && e.status === 429) setError("Consultaste tu PIN de canje muchas veces. Intenta más tarde.");
      else if (e instanceof ApiError && e.codigo === "codigo_trivial") setError("Evita secuencias (1234) o números repetidos (1111).");
      else if (e instanceof ApiError && e.codigo === "requiere_segundo_canal") setError(typeof e.extras["message"] === "string" ? e.extras["message"] : e.message);
      else setError(e instanceof Error ? e.message : "No se pudo completar. Intenta otra vez.");
    } finally { if (vivo.current && actual === vigente()) setOcupado(false); }
  };
  return <AlertDialog open onOpenChange={(abierto) => { if (!abierto) cerrar(); }}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>{esCambio ? "Cambiar PIN de canje (4 dígitos)" : "Para ver tu PIN de canje (4 dígitos), escribe tu PIN de acceso (6 dígitos)"}</AlertDialogTitle><AlertDialogDescription>Confirma tu identidad con tu PIN de acceso (6 dígitos).</AlertDialogDescription></AlertDialogHeader>
    <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="grid min-w-0 gap-4">
      <label className="grid gap-2 font-medium">PIN de acceso (6 dígitos)<CampoPin etiquetaMostrar="PIN de acceso" autoComplete="current-password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(digitos(e.target.value, 6))} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="h-14 text-center font-mono text-xl tabular-nums" /></label>
      {error && <div id={`${id}-error`} role="alert" className="text-sm text-warn-texto"><p>{error}</p>{intentos !== null && <p>{textoIntentos(intentos)}</p>}</div>}
      <Button variant="link" asChild className="h-auto min-h-11 justify-start px-0 whitespace-normal"><Link to="/recuperar" onClick={() => { guardarTelefonoPrellenado(telefono.replace(/^\+?52/, "")); cerrar(); }}>Olvidé mi PIN de acceso</Link></Button>
      {esCambio && <>
        <label className="grid gap-2 font-medium">PIN de canje nuevo (4 dígitos)<CampoPin etiquetaMostrar="PIN de canje nuevo" autoComplete="new-password" inputMode="numeric" maxLength={4} value={nuevo} onChange={(e) => setNuevo(digitos(e.target.value, 4))} className="h-14 text-center font-mono text-xl tabular-nums" /></label>
        <label className="grid gap-2 font-medium">Confirma tu PIN de canje nuevo (4 dígitos)<CampoPin etiquetaMostrar="confirmación del PIN de canje nuevo" autoComplete="new-password" inputMode="numeric" maxLength={4} value={repite} onChange={(e) => setRepite(digitos(e.target.value, 4))} className="h-14 text-center font-mono text-xl tabular-nums" /></label>
      </>}
      <AlertDialogFooter><Button type="button" variant="outline" className="min-h-14" onClick={cerrar}>Cancelar</Button><Button type="submit" className="min-h-14 whitespace-normal" disabled={!listo || ocupado}>{ocupado ? "Consultando…" : esCambio ? "Guardar PIN de canje" : "Ver mi PIN de canje"}</Button></AlertDialogFooter>
    </form>
  </AlertDialogContent></AlertDialog>;
}