import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { roleHome } from "@/components/app-shell";
import { EnrolamientoTotp } from "@/components/enrolamiento-totp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { elegirContexto, validarTotp, type RespuestaLogin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

const ROL_LABEL = { cliente: "cliente", empleado: "cajero", dueno: "dueño", staff: "Staff MiSaldo" } as const;

/** Only same-app paths are accepted as a return destination. */
export const destinoSeguro = (d: string | null | undefined) =>
  d && d.startsWith("/") && !d.startsWith("//") ? d : null;

export const tituloPaso = (r: RespuestaLogin | null) =>
  !r ? null : r.estado === "seleccionar_contexto" ? "¿Con qué perfil?" : r.estado === "requiere_totp" ? "Verificación" : null;

/**
 * Continues any RespuestaLogin (login, activation, invitation) with the same logic:
 * autenticado → enter; seleccionar_contexto → picker; requiere_totp → code; enrolamiento → notice.
 */
export function ContinuarSesion({
  respuesta,
  destino,
  onReiniciar,
  onPaso,
}: {
  respuesta: RespuestaLogin;
  destino?: string | null | undefined;
  onReiniciar: (mensaje: string) => void;
  onPaso?: (r: RespuestaLogin) => void;
}) {
  const navigate = useNavigate();
  const [actual, setActual] = useState(respuesta);
  const [codigo, setCodigo] = useState("");
  const [respaldo, setRespaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => setActual(respuesta), [respuesta]);

  useEffect(() => {
    onPaso?.(actual);
    if (actual.estado === "autenticado") {
      navigate({ to: destinoSeguro(destino) ?? roleHome(actual.contexto.rol), replace: true });
    }
  }, [actual, destino, navigate, onPaso]);

  const correr = async (fn: () => Promise<RespuestaLogin>) => {
    setCargando(true);
    try {
      setError(null);
      setCodigo("");
      setActual(await fn());
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      let msg = err?.message ?? "Algo salió mal. Intenta de nuevo.";
      const restantes = err?.extras["intentos_restantes"];
      if (typeof restantes === "number") msg += ` Te quedan ${restantes} intentos.`;
      if (err && (err.codigo === "token_invalido" || err.codigo === "contexto_no_disponible" || err.status === 401)) {
        onReiniciar(msg);
      } else setError(msg);
    } finally {
      setCargando(false);
    }
  };

  const alerta = error && (
    <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
      {error}
    </p>
  );

  if (actual.estado === "autenticado") return <p className="text-center text-muted-foreground">Entrando…</p>;

  if (actual.estado === "requiere_enrolamiento_totp") {
    return <EnrolamientoTotp token={actual.token_enrolamiento} onReiniciar={onReiniciar} />;
  }

  if (actual.estado === "seleccionar_contexto") {
    const token = actual.token_seleccion;
    return (
      <>
        {alerta}
        <ul className="flex flex-col gap-2">
          {actual.contextos.map((c) => (
            <li key={`${c.rol}-${c.negocio_id}`}>
              <Button variant="outline" size="lg" disabled={cargando} className="h-auto w-full justify-start py-3 text-left"
                onClick={() => correr(() => elegirContexto(token, c.rol, c.negocio_id))}>
                <span className="flex flex-col">
                  <span className="text-base">{c.nombre_comercial ?? "Staff MiSaldo"}</span>
                  <span className="text-xs font-normal text-muted-foreground">Como {ROL_LABEL[c.rol]}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const token = actual.token_totp;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const factor = respaldo ? { codigo_respaldo: codigo.trim() } : { codigo: codigo.trim() };
    void correr(() => validarTotp(token, factor));
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {alerta}
      <div className="flex flex-col gap-2">
        <Label htmlFor="totp">{respaldo ? "Código de respaldo" : "Código de tu app autenticadora"}</Label>
        <Input id="totp" autoFocus inputMode={respaldo ? "text" : "numeric"} autoComplete="one-time-code"
          placeholder={respaldo ? "ABCDE-FGHJK" : "123456"} className="h-12 text-center font-mono text-2xl tracking-[0.3em]"
          value={codigo} maxLength={respaldo ? 20 : 6}
          onChange={(e) => setCodigo(respaldo ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))} />
      </div>
      <Button type="submit" size="lg" disabled={cargando || (!respaldo && codigo.length !== 6)}>
        {cargando ? "Verificando…" : "Verificar"}
      </Button>
      <Button type="button" variant="link" onClick={() => { setRespaldo((r) => !r); setCodigo(""); }}>
        {respaldo ? "Usar el código de mi app" : "Usar un código de respaldo"}
      </Button>
    </form>
  );
}
