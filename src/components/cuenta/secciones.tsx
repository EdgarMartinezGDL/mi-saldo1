import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, Mail, Megaphone, ShieldCheck, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CodigosRespaldo } from "@/components/codigos-respaldo";
import { useConTotp } from "@/components/totp-provider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nuevosCodigosRespaldo } from "@/lib/api/recuperacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/client";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import {
  activarTotp,
  cambiarPin,
  confirmarActivacionTotp,
  confirmarCorreo,
  desactivarTotp,
  estadoTotp,
  guardarPromociones,
  MENSAJES_CUENTA,
  miPerfil,
  promociones,
  solicitarCorreo,
} from "./cuenta-api";

export function Tarjeta({ titulo, icono, children }: { titulo: string; icono?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{icono}{titulo}</h2>
      {children}
    </section>
  );
}

/** Spanish error with remaining attempts; a 401 sends the person to /login. */
export function useError() {
  const navigate = useNavigate();
  return (e: unknown) => {
    const err = e instanceof ApiError ? e : null;
    if (err?.status === 401) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    const r = err?.extras["intentos_restantes"];
    toast.error((err?.codigo && MENSAJES_CUENTA[err.codigo]) || err?.message || "No se pudo completar.", {
      description: typeof r === "number" ? (r === 1 ? "Te queda 1 intento." : `Te quedan ${r} intentos.`) : undefined,
    });
  };
}

const campoPin = "h-14 text-center font-mono text-xl tracking-[0.4em]";
const soloDigitos = (v: string) => v.replace(/\D/g, "");

export function usePerfil() {
  return useQuery({ queryKey: ["perfil"], queryFn: miPerfil });
}

const telefonoBonito = (t?: string | null) => {
  const d = (t ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : t ?? "";
};

export function Encabezado() {
  const { data } = usePerfil();
  const nombre = [data?.nombre, data?.apellido_paterno, data?.apellido_materno].filter(Boolean).join(" ");
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
      <span className="shadow-soft grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <UserRound className="size-7" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xl font-semibold">{nombre || "Mi cuenta"}</p>
        {data?.telefono && <p className="font-mono text-base text-muted-foreground">{telefonoBonito(data.telefono)}</p>}
      </div>
    </div>
  );
}

export function MisDatos() {
  const { data } = usePerfil();
  const queryClient = useQueryClient();
  const mostrar = useError();
  const conTotp = useConTotp();
  const [abierto, setAbierto] = useState<"pin" | "correo" | null>(null);
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [repite, setRepite] = useState("");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [esperandoCodigo, setEsperandoCodigo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const refPin = useDesplazarAlAbrir(abierto === "pin", true);
  const refCorreo = useDesplazarAlAbrir(abierto === "correo", true);
  const correoSinConfirmar = !data?.correo ? data?.correo_sin_confirmar : null;

  const limpiar = () => {
    setActual(""); setNuevo(""); setRepite(""); setCorreo(""); setCodigo(""); setEsperandoCodigo(false);
  };

  const guardarPin = async () => {
    if (nuevo !== repite) { toast.error("Los dos PIN nuevos no coinciden."); return; }
    setOcupado(true);
    try {
      const r = await conTotp(() => cambiarPin(actual, nuevo));
      toast.success("PIN actualizado", { description: r.sesiones_cerradas ? "Cerramos tu sesión en los otros dispositivos." : undefined });
      limpiar();
      setAbierto(null);
    } catch (e) {
      mostrar(e);
    } finally {
      setOcupado(false);
    }
  };

  const pedirCodigo = async () => {
    setOcupado(true);
    try {
      await conTotp(() => solicitarCorreo(actual, correo.trim()));
      setEsperandoCodigo(true);
      toast.success("Te enviamos un código de 6 dígitos a tu correo nuevo.");
    } catch (e) {
      mostrar(e);
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    setOcupado(true);
    try {
      const r = await conTotp(() => confirmarCorreo(codigo));
      queryClient.setQueryData(["perfil"], { ...data, correo: r.correo, correo_sin_confirmar: null });
      toast.success("Correo actualizado");
      limpiar();
      setAbierto(null);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.codigo === "codigo_agotado" || err?.codigo === "sin_solicitud") setEsperandoCodigo(false);
      mostrar(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta titulo="Mis datos">
      <dl className="mt-3 grid gap-2 text-base">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Correo</dt><dd className="truncate font-medium">{data?.correo ?? correoSinConfirmar ?? "Sin correo"}</dd></div>
      </dl>
      {correoSinConfirmar && <p className="mt-2 text-sm text-muted-foreground">Sin confirmar: recibe tus avisos, pero no sirve para recuperar tu acceso. Confírmalo con «Confirmar correo».</p>}
      <p className="mt-2 text-xs text-muted-foreground">Tu nombre lo corrige el negocio o soporte de MiSaldo.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant={abierto === "pin" ? "default" : "secondary"} size="lg" className="h-14 justify-start text-base" onClick={() => { limpiar(); setAbierto(abierto === "pin" ? null : "pin"); }}>
          <KeyRound className="size-5" /> Cambiar PIN
        </Button>
        <Button variant={abierto === "correo" ? "default" : "secondary"} size="lg" className="h-14 justify-start text-base" onClick={() => { limpiar(); if (abierto !== "correo") setCorreo(correoSinConfirmar ?? ""); setAbierto(abierto === "correo" ? null : "correo"); }}>
          <Mail className="size-5" /> {data?.correo ? "Cambiar correo" : correoSinConfirmar ? "Confirmar correo" : "Agregar correo"}
        </Button>
      </div>

      {abierto === "pin" && (
        <div ref={refPin} className="mt-4 grid gap-3 border-t border-border pt-4">
          <label className="grid gap-2 font-medium">PIN actual<Input type="password" inputMode="numeric" maxLength={128} value={actual} onChange={(e) => setActual(e.target.value)} className={campoPin} /></label>
          <label className="grid gap-2 font-medium">PIN nuevo (6 dígitos)<Input type="password" inputMode="numeric" maxLength={6} value={nuevo} onChange={(e) => setNuevo(soloDigitos(e.target.value))} className={campoPin} /></label>
          <label className="grid gap-2 font-medium">Repite el PIN nuevo<Input type="password" inputMode="numeric" maxLength={6} value={repite} onChange={(e) => setRepite(soloDigitos(e.target.value))} className={campoPin} /></label>
          <Button size="lg" className="h-14 text-base" disabled={ocupado || actual.length < 4 || nuevo.length !== 6 || repite.length !== 6} onClick={() => void guardarPin()}>
            {ocupado ? "Guardando…" : "Guardar PIN nuevo"}
          </Button>
        </div>
      )}

      {abierto === "correo" && (
        <div ref={refCorreo} className="mt-4 grid gap-3 border-t border-border pt-4">
          {!esperandoCodigo ? (
            <>
              <label className="grid gap-2 font-medium">Correo nuevo<Input type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="h-14 text-base" placeholder="tucorreo@ejemplo.mx" /></label>
              <label className="grid gap-2 font-medium">Tu PIN<Input type="password" inputMode="numeric" maxLength={128} value={actual} onChange={(e) => setActual(e.target.value)} className={campoPin} /></label>
              <Button size="lg" className="h-14 text-base" disabled={ocupado || !/^\S+@\S+\.\S+$/.test(correo.trim()) || actual.length < 4} onClick={() => void pedirCodigo()}>
                {ocupado ? "Enviando…" : "Enviar código"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Escribe el código que llegó a {correo}.</p>
              <label className="grid gap-2 font-medium">Código del correo<Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(soloDigitos(e.target.value))} className={campoPin} /></label>
              <Button size="lg" className="h-14 text-base" disabled={ocupado || codigo.length !== 6} onClick={() => void confirmar()}>
                {ocupado ? "Confirmando…" : "Confirmar correo"}
              </Button>
              <Button variant="ghost" onClick={() => setEsperandoCodigo(false)}>Pedir otro código</Button>
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

/** Owner-only optional 2FA (autenticacion.md §7). */
export function Seguridad({ staff = false }: { staff?: boolean }) {
  const queryClient = useQueryClient();
  const mostrar = useError();
  const { data, refetch } = useQuery({ queryKey: ["totp-estado"], queryFn: estadoTotp });
  const activo = data?.estado === "activo";
  const [paso, setPaso] = useState<"nada" | "pin" | "qr" | "codigos" | "desactivar" | "respaldo">("nada");
  const [avisoRespaldo, setAvisoRespaldo] = useState(false);
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [qr, setQr] = useState<{ secreto: string; otpauth_uri: string } | null>(null);
  const [respaldo, setRespaldo] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try { await fn(); } catch (e) { mostrar(e); } finally { setOcupado(false); }
  };

  return (
    <Tarjeta titulo="Seguridad" icono={<ShieldCheck className="size-5 text-primary" />}>
      <p className="mt-1 text-sm text-muted-foreground">
        Verificación en dos pasos: {activo ? (staff ? "activada (obligatoria para Staff)" : "activada") : "desactivada"}. {activo ? "Al entrar te pediremos el código de tu app autenticadora." : "Pide un código de tu app autenticadora al entrar y en acciones importantes."}
      </p>

      {paso === "nada" && activo && (
        <Button size="lg" variant="secondary" className="mt-4 h-14 w-full text-base sm:w-auto" onClick={() => { setCodigo(""); setAvisoRespaldo(true); }}>
          Generar códigos de respaldo nuevos
        </Button>
      )}

      {paso === "respaldo" && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 font-medium">Código de 6 dígitos de tu app<Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(soloDigitos(e.target.value))} className={campoPin} /></label>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="h-14 flex-1" onClick={() => setPaso("nada")}>Cancelar</Button>
            <Button size="lg" className="h-14 flex-1" disabled={ocupado || codigo.length !== 6} onClick={() => void correr(async () => {
              const r = await nuevosCodigosRespaldo(codigo);
              setCodigo("");
              setRespaldo(r.codigos_respaldo);
              setPaso("codigos");
            })}>
              {ocupado ? "Generando…" : "Generar"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={avisoRespaldo} onOpenChange={setAvisoRespaldo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar códigos de respaldo nuevos?</AlertDialogTitle>
            <AlertDialogDescription>Los códigos anteriores dejarán de servir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setPaso("respaldo")}>Sí, generar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {paso === "nada" && !(staff && activo) && (
        <Button size="lg" variant={activo ? "outline" : "default"} className="mt-4 h-14 w-full text-base sm:w-auto" onClick={() => { setPin(""); setCodigo(""); setPaso(activo ? "desactivar" : "pin"); }}>
          {activo ? "Desactivar verificación en dos pasos" : "Activar verificación en dos pasos"}
        </Button>
      )}

      {paso === "pin" && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 font-medium">Tu PIN<Input type="password" inputMode="numeric" maxLength={128} value={pin} onChange={(e) => setPin(e.target.value)} className={campoPin} /></label>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="h-14 flex-1" onClick={() => setPaso("nada")}>Cancelar</Button>
            <Button size="lg" className="h-14 flex-1" disabled={ocupado || pin.length < 4} onClick={() => void correr(async () => { setQr(await activarTotp(pin)); setPin(""); setPaso("qr"); })}>
              {ocupado ? "Revisando…" : "Continuar"}
            </Button>
          </div>
        </div>
      )}

      {paso === "qr" && qr && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm">Escanea este código con tu app autenticadora (Google Authenticator, Microsoft Authenticator…).</p>
          <div className="mx-auto rounded-2xl bg-white p-4"><QRCodeSVG value={qr.otpauth_uri} size={192} /></div>
          <p className="text-center text-xs text-muted-foreground">¿No puedes escanear? Escribe esta clave: <span className="break-all font-mono">{qr.secreto}</span></p>
          <label className="grid gap-2 font-medium">Código de 6 dígitos de tu app<Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(soloDigitos(e.target.value))} className={campoPin} /></label>
          <Button size="lg" className="h-14" disabled={ocupado || codigo.length !== 6} onClick={() => void correr(async () => {
            const r = await confirmarActivacionTotp(codigo);
            setRespaldo(r.codigos_respaldo);
            setQr(null);
            setCodigo("");
            setPaso("codigos");
            queryClient.setQueryData(["totp-estado"], { ...data, estado: "activo" });
            if (r.sesiones_revocadas) toast.info("Cerramos tu sesión de dueño en los otros dispositivos.");
          })}>
            {ocupado ? "Activando…" : "Activar"}
          </Button>
        </div>
      )}

      {paso === "codigos" && (
        <div className="mt-4">
          <CodigosRespaldo codigos={respaldo} boton="Listo" onListo={() => { setRespaldo([]); setPaso("nada"); }} />
        </div>
      )}

      {paso === "desactivar" && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 font-medium">Tu PIN<Input type="password" inputMode="numeric" maxLength={128} value={pin} onChange={(e) => setPin(e.target.value)} className={campoPin} /></label>
          <label className="grid gap-2 font-medium">Código de tu app<Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(soloDigitos(e.target.value))} className={campoPin} /></label>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="h-14 flex-1" onClick={() => setPaso("nada")}>Cancelar</Button>
            <Button variant="destructive" size="lg" className="h-14 flex-1" disabled={ocupado || pin.length < 4 || codigo.length !== 6} onClick={() => void correr(async () => {
              await desactivarTotp(pin, codigo);
              toast.success("Verificación en dos pasos desactivada");
              setPaso("nada");
              void refetch();
            })}>
              {ocupado ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

/** Client-only promotions opt-in for this business (cliente.md §8). */
export function Promociones() {
  const queryClient = useQueryClient();
  const mostrar = useError();
  const { data } = useQuery({ queryKey: ["promociones"], queryFn: promociones });
  const [ocupado, setOcupado] = useState(false);
  const acepta = data?.acepta_promociones ?? false;

  const cambiar = async (v: boolean) => {
    setOcupado(true);
    try {
      const r = await guardarPromociones(v);
      queryClient.setQueryData(["promociones"], r);
      toast.success(r.acepta_promociones ? "Recibirás promociones de este negocio" : "Ya no recibirás promociones de este negocio");
    } catch (e) {
      mostrar(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta titulo="Promociones" icono={<Megaphone className="size-5 text-primary" />}>
      <label className="mt-3 flex min-h-14 items-center justify-between gap-4 rounded-xl bg-secondary px-4 py-3">
        <span className="text-base">Quiero recibir promociones de este negocio (cumpleaños, ofertas)</span>
        <Switch checked={acepta} disabled={ocupado || !data} onCheckedChange={(v) => void cambiar(v)} aria-label="Recibir promociones" />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">Si no las aceptas, tu saldo y tus tarjetas siguen igual.</p>
    </Tarjeta>
  );
}
