import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContinuarSesion } from "@/components/continuar-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import type { RespuestaLogin } from "@/lib/api/auth";
import { instante } from "@/lib/api/formato";
import { completarRecuperacion, solicitarRecuperacion, verificarRecuperacion, type Canal, type Verificacion } from "@/lib/api/recuperacion";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recuperar")({
  validateSearch: (s: Record<string, unknown>): { telefono?: string } => {
    const v = s["telefono"];
    const t = typeof v === "string" || typeof v === "number" ? String(v).replace(/\D/g, "") : "";
    return t.length === 10 ? { telefono: t } : {};
  },
  head: () => ({
    meta: [
      { title: "Olvidé mi PIN · MiSaldo" },
      { name: "description", content: "Recupera el acceso a MiSaldo con un código por WhatsApp o correo." },
      { property: "og:title", content: "Olvidé mi PIN · MiSaldo" },
      { property: "og:description", content: "Verifica tu teléfono y crea un PIN nuevo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recuperar,
});

const NOMBRE: Record<Canal, string> = { whatsapp: "WhatsApp", correo: "correo" };
const PIN_SIMPLE = (p: string) => /^(\d)\1{5}$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p);

function Recuperar() {
  const inicial = String(Route.useSearch().telefono ?? "");
  const [paso, setPaso] = useState<"telefono" | "codigo" | "aviso" | "pin" | "sesion">("telefono");
  const [telefono, setTelefono] = useState(inicial);
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [verif, setVerif] = useState<Verificacion | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [canje, setCanje] = useState("");
  const [sesion, setSesionPendiente] = useState<RespuestaLogin | null>(null);
  const refPaso = useDesplazarAlAbrir(paso, true);

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.codigo === "token_invalido" || (err?.status === 401 && paso === "pin")) {
        setPaso("telefono");
        setVerif(null);
        setError("El tiempo para recuperar tu acceso terminó. Empieza de nuevo");
      } else if (err?.codigo === "codigo_invalido" || err?.codigo === "codigo_agotado") {
        const crudo = err.extras["message"];
        setError(typeof crudo === "string" && crudo ? crudo : err.codigo === "codigo_invalido" ? "Código incorrecto o vencido" : "Demasiados intentos con este código. Solicita uno nuevo.");
      } else setError(err?.message ?? "Algo salió mal. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  const tel = telefonoE164(telefono);
  const enviar = () => correr(async () => {
    const r = await solicitarRecuperacion(tel, canal);
    setMensaje(r.mensaje);
    setCodigo("");
    setPaso("codigo");
  });

  const verificar = () => correr(async () => {
    const r = await verificarRecuperacion(tel, canal, codigo);
    setVerif(r);
    setCodigo("");
    if (r.puede_restablecer_pin) return setPaso("pin");
    if (r.aviso) return setPaso("aviso");
    const req = Array.isArray(r.canales_requeridos) ? r.canales_requeridos : [];
    const falta = req.find((c) => !r.canales_verificados.includes(c)) ?? (canal === "whatsapp" ? "correo" : "whatsapp");
    setCanal(falta);
    setMensaje(null);
    setNota(`Por seguridad, tu cuenta también pide el código por ${NOMBRE[falta]}`);
    setPaso("telefono");
  });

  const errorPin = pin.length === 6 && PIN_SIMPLE(pin) ? "Usa 6 dígitos sin secuencias (123456) ni repetidos (111111)." :
    pin2.length === 6 && pin !== pin2 ? "Los dos PIN no coinciden." : null;

  const guardar = () => correr(async () => {
    if (!verif) return;
    const r = await completarRecuperacion({
      token_recuperacion: verif.token_recuperacion,
      pin,
      ...(verif.puede_cambiar_codigo_canje && canje.length === 4 ? { codigo_canje: canje } : {}),
    });
    toast.success(`Listo: tu PIN se cambió. Cerramos tu sesión en los demás dispositivos (${r.sesiones_cerradas})`);
    if (r.codigo_canje_restringido_hasta) setNota(`Por seguridad, podrás cambiar tu código de canje después del ${instante(r.codigo_canje_restringido_hasta)}`);
    else setNota(null);
    setPin(""); setPin2(""); setCanje("");
    setSesionPendiente(r.sesion);
    setPaso("sesion");
  });

  const campo = "h-12 text-center font-mono text-xl tracking-[0.3em]";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div ref={refPaso} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-soft ring-1 ring-border">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><LifeBuoy className="size-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Olvidé mi PIN</h1>
            <p className="text-sm text-muted-foreground">Recupera el acceso to tu cuenta</p>
          </div>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
        {nota && paso !== "aviso" && <p className="mb-4 rounded-xl bg-warn/10 p-3 text-sm font-medium text-warn">{nota}</p>}

        {paso === "telefono" && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tel">Teléfono (10 dígitos)</Label>
              <Input id="tel" inputMode="numeric" autoComplete="tel" placeholder="55 1234 5678" className="h-12 text-lg"
                value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">¿Por dónde te enviamos el código?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["whatsapp", "correo"] as const).map((c) => (
                  <button key={c} type="button" aria-pressed={canal === c} onClick={() => setCanal(c)}
                    className={cn("h-12 rounded-xl text-base font-medium", canal === c ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                    {c === "whatsapp" ? "WhatsApp" : "Correo"}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" size="lg" disabled={ocupado || telefono.length !== 10}>{ocupado ? "Enviando…" : "Enviar código"}</Button>
          </form>
        )}

        {paso === "codigo" && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void verificar(); }}>
            {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="cod">Código de 6 dígitos</Label>
              <Input id="cod" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={campo}
                value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Button type="submit" size="lg" disabled={ocupado || codigo.length !== 6}>{ocupado ? "Verificando…" : "Verificar"}</Button>
            <Button type="button" variant="link" disabled={ocupado} onClick={() => void enviar()}>No me llegó: enviar otra vez</Button>
          </form>
        )}

        {paso === "aviso" && verif?.aviso && (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{verif.aviso}</p>
            <Button asChild size="lg"><Link to="/login">Volver al inicio</Link></Button>
          </div>
        )}

        {paso === "pin" && verif && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p1">PIN nuevo (6 dígitos)</Label>
              <Input id="p1" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className={campo}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p2">Repite el PIN nuevo</Label>
              <Input id="p2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className={campo}
                value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
            </div>
            {verif.puede_cambiar_codigo_canje && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="canje">Nuevo código de canje (4 dígitos)</Label>
                <Input id="canje" type="password" inputMode="numeric" maxLength={4} className={campo}
                  value={canje} onChange={(e) => setCanje(e.target.value.replace(/\D/g, ""))} />
                <p className="text-xs text-muted-foreground">Si también olvidaste tu código de canje, cámbialo aquí</p>
              </div>
            )}
            {errorPin && <p className="text-sm text-destructive">{errorPin}</p>}
            <Button type="submit" size="lg"
              disabled={ocupado || pin.length !== 6 || pin !== pin2 || !!errorPin || (canje.length > 0 && canje.length !== 4)}>
              {ocupado ? "Guardando…" : "Guardar PIN nuevo"}
            </Button>
          </form>
        )}

        {paso === "sesion" && sesion && (
          <ContinuarSesion respuesta={sesion} onReiniciar={(m) => { setError(m); setPaso("telefono"); setSesionPendiente(null); }} />
        )}

        {paso !== "sesion" && (
          <Button asChild variant="ghost" className="mt-4 w-full">
            <Link to="/login"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
