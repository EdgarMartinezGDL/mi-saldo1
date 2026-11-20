import { Search, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Button } from "@/components/ui/button";
import { BotonQrRegistro } from "@/components/qr-registro";
import { aprobarSolicitudRegistro, buscarCliente, rechazarSolicitudRegistro, type ClienteCaja, type SolicitudRegistro } from "@/lib/api/caja";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import type { AltaRespuesta } from "./caja-extra";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { avisarError, useCaja } from "./caja-contexto";

import { Tecla, useConMouse, useDigitos, useFocoCaja, useTecla } from "./teclado";

const formato = (d: string) => [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(" ");

export function PasoBuscar({ inicial, onEncontrado, onAlta, onAltaHecha }: { inicial: string; onEncontrado: (tel: string, c: ClienteCaja) => void; onAlta: (tel: string) => void; onAltaHecha?: (tel: string, r: AltaRespuesta) => void }) {
  const conMouse = useConMouse();
  useFocoCaja();
  const { ejecutar, moneda } = useCaja();
  const [tel, setTel] = useState(inicial);
  const [noExiste, setNoExiste] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudRegistro | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const bloqueo = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [qrAbierto, setQrAbierto] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (noExiste) resultadoRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [noExiste]);

  const buscar = async () => {
    if (ocupado || tel.length !== 10) return;
    setOcupado(true);
    try {
      const r = await ejecutar(() => buscarCliente(telefonoE164(tel)));
      if (r.encontrado) onEncontrado(tel, r);
      else { setSolicitud(r.solicitud_registro ?? null); setNoExiste(true); }
    } catch (e) {
      avisarError(e, moneda);
    } finally {
      setOcupado(false);
    }
  };

  const aprobar = async () => {
    if (!solicitud || !onAltaHecha || bloqueo.current || ocupado) return;
    bloqueo.current = true; setOcupado(true);
    try { const r = await ejecutar(() => aprobarSolicitudRegistro(solicitud.solicitud_id)); onAltaHecha(tel, r); }
    catch (e) {
      if (e instanceof ApiError && e.status === 404 && e.codigo === "solicitud_no_encontrada") {
        toast.info("La solicitud ya no existe (venció o ya se atendió)");
        setSolicitud(null);
        try {
          const r = await ejecutar(() => buscarCliente(telefonoE164(tel)));
          if (r.encontrado) onEncontrado(tel, r);
          else { setSolicitud(r.solicitud_registro ?? null); setNoExiste(true); }
        } catch (err) { avisarError(err, moneda); }
      } else avisarError(e, moneda);
    } finally { bloqueo.current = false; setOcupado(false); }
  };
  const rechazar = async () => {
    if (!solicitud || bloqueo.current || ocupado) return;
    bloqueo.current = true; setOcupado(true);
    try { await ejecutar(() => rechazarSolicitudRegistro(solicitud.solicitud_id)); setSolicitud(null); setRechazando(false); }
    catch (e) { avisarError(e, moneda); }
    finally { bloqueo.current = false; setOcupado(false); }
  };

  const onKey = (k: string) => {
    if (ocupado || qrAbierto) return;
    setNoExiste(false);
    setSolicitud(null);
    if (k === "borrar") setTel((p) => p.slice(0, -1));
    else if (k === "limpiar") setTel("");
    else setTel((p) => p.length < 10 ? p + k : p);
  };
  useDigitos(onKey, { activo: !ocupado && !qrAbierto });
  useTecla((e) => {
    if (e.key === "Escape") { onKey("limpiar"); return true; }
    if (e.key === "Enter" && tel.length === 10) {
      if (solicitud) void aprobar(); else if (noExiste) onAlta(tel); else void buscar();
      return true;
    }
    return false;
  }, { activo: !ocupado && !qrAbierto });
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buscar cliente</h1>
        <p className="mt-1 text-base text-muted-foreground">{conMouse ? "Escribe los 10 dígitos de su teléfono con el teclado y presiona Enter." : "Escribe los 10 dígitos de su teléfono."}</p>
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Teléfono del cliente</p>
        <p className="mt-2 min-h-[3.5rem] font-mono text-4xl font-bold tabular-nums tracking-wider">
          {formato(tel) || <span className="text-muted-foreground">55 0000 0000</span>}
        </p>
        <NumericKeypad compacto={conMouse} className="mt-4" onKey={onKey} />
        <Button size="lg" className="mt-4 h-14 w-full text-lg" disabled={ocupado || tel.length !== 10} onClick={() => void buscar()}>
          <Search className="size-5" /> {ocupado ? "Buscando…" : "Buscar"}<Tecla>Enter</Tecla>
        </Button>
      </div>
      <BotonQrRegistro onAbiertoChange={setQrAbierto} />
      {noExiste && (
        <div ref={resultadoRef} className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {solicitud ? <>
            <p className="text-lg font-semibold">Se registró desde el QR</p>
            <p className="mt-3 break-words text-2xl font-bold">{[solicitud.nombre, solicitud.apellido_paterno, solicitud.apellido_materno].filter(Boolean).join(" ")}</p>
            <p className="mt-2">Cumpleaños: {solicitud.nacimiento_dia} de {new Date(2000, solicitud.nacimiento_mes - 1, 1).toLocaleString("es-MX", { month: "long" })}</p>
            <p className="break-words">Correo: {solicitud.correo_enmascarado}</p>
            <p className="mt-1 text-sm text-muted-foreground">Vence: {new Date(solicitud.expira_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
            <Button className="mt-4 min-h-14 w-full text-lg" disabled={ocupado} onClick={() => void aprobar()}>Aprobar registro<Tecla>Enter</Tecla></Button>
            <Button variant="secondary" className="mt-3 min-h-12 w-full" disabled={ocupado} onClick={() => setRechazando(true)}>Rechazar</Button>
            <Button variant="link" className="mt-2 min-h-11 w-full whitespace-normal" disabled={ocupado} onClick={() => onAlta(tel)}>Mejor capturarlo a mano</Button>
          </> : <><p className="text-lg font-semibold">Este teléfono aún no es cliente</p>
          <p className="mt-1 text-muted-foreground">Puedes darlo de alta ahora mismo.</p>
          <Button size="lg" className="mt-4 h-14 w-full text-lg" onClick={() => onAlta(tel)}>
            <UserPlus className="size-5" /> Dar de alta<Tecla>Enter</Tecla>
          </Button>
          </>}
        </div>
      )}
      <AlertDialog open={rechazando} onOpenChange={(v) => { if (!ocupado) setRechazando(v); }}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>¿Rechazar el registro de {solicitud?.nombre}?</AlertDialogTitle><AlertDialogDescription>Se borrarán sus datos.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={ocupado} onClick={(e) => { e.preventDefault(); void rechazar(); }}>Rechazar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </div>
  );
}
