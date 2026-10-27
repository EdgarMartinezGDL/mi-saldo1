import { useNavigate } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CodigosRespaldo } from "@/components/codigos-respaldo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, setSesion, type Sesion } from "@/lib/api/client";
import { confirmarEnrolamiento, iniciarEnrolamiento } from "@/lib/api/recuperacion";

/** Mandatory Staff authenticator enrolment during sign-in (requiere_enrolamiento_totp). */
export function EnrolamientoTotp({ token, onReiniciar }: { token: string; onReiniciar: (m: string) => void }) {
  const navigate = useNavigate();
  const [qr, setQr] = useState<{ secreto: string; otpauth_uri: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState<{ codigos: string[]; sesion: Sesion } | null>(null);

  const fallo = useCallback((e: unknown) => {
    const err = e instanceof ApiError ? e : null;
    if (err?.status === 401) return onReiniciar("El tiempo terminó. Inicia sesión de nuevo");
    if (err?.codigo === "codigo_incorrecto") {
      const r = err.extras["intentos_restantes"];
      return setError(typeof r === "number" ? (r === 1 ? "Código incorrecto. Te queda 1 intento" : `Código incorrecto. Te quedan ${r} intentos`) : "Código incorrecto.");
    }
    setError(err?.message ?? "Algo salió mal. Intenta de nuevo.");
  }, [onReiniciar]);

  const generar = useCallback(async () => {
    setOcupado(true);
    try {
      setError(null);
      setCodigo("");
      setQr(await iniciarEnrolamiento(token));
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  }, [token, fallo]);

  useEffect(() => { void generar(); }, [generar]);

  const confirmar = async () => {
    setOcupado(true);
    try {
      setError(null);
      const r = await confirmarEnrolamiento(token, codigo);
      setListo({ codigos: r.codigos_respaldo, sesion: r.sesion });
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "sin_enrolamiento") {
        setOcupado(false);
        return void generar();
      }
      fallo(e);
      setCodigo("");
    } finally {
      setOcupado(false);
    }
  };

  if (listo) {
    return (
      <CodigosRespaldo codigos={listo.codigos} boton="Entrar" onListo={() => {
        setSesion(listo.sesion);
        void navigate({ to: "/staff", replace: true });
      }} />
    );
  }

  return (
    <div className="grid gap-3">
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
      <p className="text-sm">Tu cuenta de Staff necesita una app autenticadora para entrar.</p>
      <ol className="list-decimal pl-5 text-sm text-muted-foreground">
        <li>Abre Google Authenticator, Microsoft Authenticator u otra app.</li>
        <li>Escanea el código.</li>
        <li>Escribe el código de 6 dígitos que te muestra.</li>
      </ol>
      {qr ? (
        <>
          <div className="mx-auto rounded-2xl bg-white p-4"><QRCodeSVG value={qr.otpauth_uri} size={192} /></div>
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
            <span className="flex-1 break-all font-mono text-sm">{qr.secreto}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(qr.secreto).then(() => toast.success("Clave copiada"))}>
              <Copy className="size-4" /> Copiar
            </Button>
          </div>
          <Button type="button" variant="link" disabled={ocupado} onClick={() => void generar()}>Generar otro código QR</Button>
          <Label htmlFor="enrol">Código de 6 dígitos</Label>
          <Input id="enrol" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} className="h-12 text-center font-mono text-2xl tracking-[0.3em]" />
          <Button size="lg" disabled={ocupado || codigo.length !== 6} onClick={() => void confirmar()}>
            {ocupado ? "Verificando…" : "Verificar"}
          </Button>
        </>
      ) : (
        <p className="text-center text-muted-foreground">{ocupado ? "Generando código…" : ""}</p>
      )}
    </div>
  );
}
