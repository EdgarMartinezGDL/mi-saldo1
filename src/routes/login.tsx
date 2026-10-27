import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ContinuarSesion, destinoSeguro } from "@/components/continuar-sesion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type RespuestaLogin } from "@/lib/api/auth";
import { ApiError, setSesion, telefonoE164, type Sesion } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { volver?: string } => {
    const v = destinoSeguro(typeof s["volver"] === "string" ? s["volver"] : null);
    return v ? { volver: v } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar · MiSaldo" },
      { name: "description", content: "Entra a MiSaldo con tu teléfono y tu PIN." },
      { property: "og:title", content: "Entrar · MiSaldo" },
      { property: "og:description", content: "Acceso con teléfono, PIN y verificación en dos pasos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { volver } = Route.useSearch();
  const [sesionPendiente, setSesionPendiente] = useState<RespuestaLogin | null>(null);
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const paso = {
    tipo: !sesionPendiente || sesionPendiente.estado === "autenticado"
      ? "credenciales"
      : sesionPendiente.estado === "seleccionar_contexto" ? "contexto" : "totp",
  } as const;

  const [confirmando, setConfirmando] = useState(false);

  const pedirConfirmacion = (e: FormEvent) => {
    e.preventDefault();
    if (telefono.replace(/\D/g, "").length !== 10) return setError("Escribe los 10 dígitos de tu teléfono.");
    if (pin.length < 4 || pin.length > 128) return setError("Escribe tu PIN (de 4 a 128 caracteres).");
    setError(null);
    setConfirmando(true);
  };

  const enviarCredenciales = async () => {
    setConfirmando(false);
    setCargando(true);
    try {
      setError(null);
      setSesionPendiente(await login(telefonoE164(telefono), pin));
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      let msg = apiErr?.message ?? "Algo salió mal. Intenta de nuevo.";
      const restantes = apiErr?.extras["intentos_restantes"];
      if (typeof restantes === "number") msg += ` Te quedan ${restantes} intentos.`;
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  let accesoModoDiseno = null;
  if (import.meta.env.DEV) {
    const activarModoDiseno = () => {
      const sesionDiseno: Sesion = {
        access_token: "solo-desarrollo",
        token_type: "Bearer",
        expires_in: 3600,
        sesion_expira_en: new Date(Date.now() + 3_600_000).toISOString(),
        contexto: {
          rol: "dueno",
          negocio_id: "modo-diseno",
          nombre_comercial: "Taquería La Cuna",
        },
      };
      setSesion(sesionDiseno);
      navigate({ to: "/panel", replace: true });
    };

    accesoModoDiseno = (
      <div className="mt-5 border-t border-border pt-5">
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={activarModoDiseno}>
          Modo Diseño
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Disponible únicamente en esta vista previa.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-soft ring-1 ring-border">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
            {paso.tipo === "totp" ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {paso.tipo === "credenciales" ? "Entrar" : paso.tipo === "contexto" ? "¿Con qué perfil?" : "Verificación"}
            </h1>
            <p className="text-sm text-muted-foreground">MiSaldo · By MicroFix Cloud</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {!sesionPendiente && (
          <form onSubmit={pedirConfirmacion} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tel">Teléfono (10 dígitos)</Label>
              <Input id="tel" inputMode="numeric" autoComplete="tel" placeholder="55 1234 5678" className="h-12 text-lg"
                value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^\d ]/g, ""))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pin">PIN</Label>
              <Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={128} className="h-12 text-lg"
                value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
            <Button type="submit" size="lg" disabled={cargando}>{cargando ? "Entrando…" : "Entrar"}</Button>
            <Link to="/recuperar" search={telefono.replace(/\D/g, "").length === 10 ? { telefono: telefono.replace(/\D/g, "") } : {}}
              className="text-center text-sm font-medium text-primary hover:underline">
              Olvidé mi PIN
            </Link>
          </form>
        )}

        {sesionPendiente && (
          <ContinuarSesion respuesta={sesionPendiente} destino={volver}
            onReiniciar={(m) => { setError(m); setSesionPendiente(null); }} />
        )}

        {accesoModoDiseno}

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar inicio de sesión</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Confirmas que deseas iniciar sesión en esta cuenta?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void enviarCredenciales()}>
                Sí, iniciar sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
