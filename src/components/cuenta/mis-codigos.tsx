import { KeyRound, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { instante } from "@/lib/api/formato";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { cambiarCodigos, consultarCodigos, type MisCodigos } from "./cuenta-api";
import { Tarjeta, useError } from "./secciones";
import { escritorCopia } from "@/lib/sin-conexion-sesion";

const soloDigitos = (v: string) => v.replace(/\D/g, "");
const campo = "h-14 text-center font-mono text-xl tracking-[0.4em]";

const esTrivial = (c: string) => {
  const d = c.split("").map(Number);
  const pasos = d.slice(1).map((x, i) => x - (d[i] ?? 0));
  return pasos.every((p) => p === 0) || pasos.every((p) => p === 1) || pasos.every((p) => p === -1);
};

type Tipo = "acumulacion" | "canje";
const NOMBRE: Record<Tipo, string> = { acumulacion: "acumulación", canje: "canje" };

export function TarjetaMisCodigos() {
  const mostrar = useError();
  const [pin, setPin] = useState("");
  const [datos, setDatos] = useState<MisCodigos | null>(null);
  const [cambiando, setCambiando] = useState<Tipo | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [repite, setRepite] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const refDatos = useDesplazarAlAbrir(datos);
  const refCambio = useDesplazarAlAbrir(cambiando, true);

  const ocultar = () => {
    setPin(""); setDatos(null); setCambiando(null); setNuevo(""); setRepite(""); setConfirmar(false);
  };

  const errorPin = (e: unknown) => e instanceof ApiError && e.codigo === "pin_incorrecto";

  const consultar = async (p = pin) => {
    const guardar = escritorCopia();
    const r = await consultarCodigos(p);
    guardar({ codigo: r.codigo_acumulacion });
    setDatos(r);
    if (r.codigo_canje_requiere_cambio) { setCambiando("canje"); setNuevo(""); setRepite(""); }
  };

  const ver = async () => {
    setOcupado(true);
    try { await consultar(); }
    catch (e) { if (errorPin(e)) setPin(""); mostrar(e); }
    finally { setOcupado(false); }
  };

  const abrirCambio = (t: Tipo) => { setCambiando(t); setNuevo(""); setRepite(""); };

  const validar = () => {
    if (nuevo !== repite) { toast.error("Los dos códigos no coinciden."); return; }
    if (esTrivial(nuevo)) { toast.error("Los códigos no pueden ser una secuencia (1234) ni repetir el mismo dígito (1111)"); return; }
    setConfirmar(true);
  };

  const guardar = async () => {
    if (!cambiando) return;
    setConfirmar(false);
    setOcupado(true);
    try {
      const body = cambiando === "canje" ? { pin, codigo_canje: nuevo } : { pin, codigo_acumulacion: nuevo };
      const r = await cambiarCodigos(body);
      toast.success(`Código de ${NOMBRE[cambiando]} actualizado`, { description: [cambiando === "canje" ? "Te avisamos por WhatsApp y correo. Si estaba bloqueado, ya quedó desbloqueado." : "", ...(r.advertencias ?? [])].filter(Boolean).join(" ") || undefined });
      setCambiando(null); setNuevo(""); setRepite("");
      await consultar();
    } catch (e) {
      if (errorPin(e)) ocultar();
      mostrar(e);
    } finally {
      setOcupado(false);
    }
  };

  const bloqueoFuturo = datos?.codigo_canje_bloqueado_hasta && new Date(datos.codigo_canje_bloqueado_hasta).getTime() > Date.now();

  return (
    <Tarjeta titulo="Mis códigos" icono={<KeyRound className="size-5 text-primary" />}>
      {!datos ? (
        <div className="mt-3 grid gap-3">
          <p className="text-base text-muted-foreground">Escribe tu PIN para ver tu código de acumulación y el estado de tu código de canje.</p>
          <label className="grid gap-2 font-medium">Tu PIN
            <Input type="password" inputMode="numeric" maxLength={128} value={pin} onChange={(e) => setPin(e.target.value)} className={campo} />
          </label>
          <Button size="lg" className="h-14 text-base" disabled={ocupado || pin.length < 4} onClick={() => void ver()}>
            {ocupado ? "Revisando…" : "Ver mis códigos"}
          </Button>
        </div>
      ) : (
        <div ref={refDatos} className="mt-4 grid gap-4">
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm font-medium">Código de acumulación</p>
            {datos.codigo_acumulacion ? (
              <p className="mt-1 font-mono text-5xl font-bold tracking-[0.3em] tabular-nums">{datos.codigo_acumulacion}</p>
            ) : (
              <p className="mt-1 text-base">Aún no tienes código de acumulación</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">Para sumar saldo o sellos</p>
          </div>

          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm font-medium">Código de canje</p>
            {datos.tiene_codigo_canje ? (
              <p className="mt-1 font-mono text-5xl font-bold tracking-[0.3em]" aria-label="Código oculto">••••</p>
            ) : (
              <p className="mt-1 text-base">Aún no tienes código de canje</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">Para usar tu saldo o cobrar premios. No lo mostramos por seguridad: si lo olvidaste, cámbialo.</p>
            {datos.codigo_canje_requiere_cambio ? (
              <p className="mt-2 flex gap-2 text-sm font-medium text-warn"><TriangleAlert className="size-4 shrink-0" />Tu código de canje está bloqueado por muchos intentos fallidos. Para desbloquearlo, cámbialo.</p>
            ) : bloqueoFuturo ? (
              <p className="mt-2 flex gap-2 text-sm font-medium text-warn"><TriangleAlert className="size-4 shrink-0" /><span>{`Tu código de canje está bloqueado hasta el ${instante(datos.codigo_canje_bloqueado_hasta)}`} <span>Si no fuiste tú quien lo intentó, cámbialo ahora.</span></span></p>
            ) : null}
          </div>

          {cambiando ? (
            <div ref={refCambio} className="grid gap-3 border-t border-border pt-4">
              <p className="font-semibold">Cambiar código de {NOMBRE[cambiando]}</p>
              <label className="grid gap-2 font-medium">Código nuevo
                <Input type={cambiando === "canje" ? "password" : "text"} inputMode="numeric" maxLength={4} value={nuevo} onChange={(e) => setNuevo(soloDigitos(e.target.value).slice(0, 4))} className={campo} />
              </label>
              <label className="grid gap-2 font-medium">Repite el código nuevo
                <Input type={cambiando === "canje" ? "password" : "text"} inputMode="numeric" maxLength={4} value={repite} onChange={(e) => setRepite(soloDigitos(e.target.value).slice(0, 4))} className={campo} />
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="h-14 flex-1" onClick={() => setCambiando(null)}>Cancelar</Button>
                <Button size="lg" className="h-14 flex-1" disabled={ocupado || nuevo.length !== 4 || repite.length !== 4} onClick={validar}>
                  {ocupado ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" size="lg" className="h-14 text-base" onClick={() => abrirCambio("acumulacion")}>
                {datos.codigo_acumulacion ? "Cambiar código de acumulación" : "Crear código de acumulación"}
              </Button>
              <Button variant="secondary" size="lg" className="h-14 text-base" onClick={() => abrirCambio("canje")}>
                {datos.tiene_codigo_canje ? "Cambiar código de canje" : "Crear código de canje"}
              </Button>
            </div>
          )}
          <Button variant="ghost" size="lg" className="h-12" onClick={ocultar}>Ocultar</Button>
        </div>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar tu código de {cambiando ? NOMBRE[cambiando] : ""}?</AlertDialogTitle>
            <AlertDialogDescription>Desde ahora dictarás el código nuevo en caja.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void guardar()}>Sí, cambiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tarjeta>
  );
}
