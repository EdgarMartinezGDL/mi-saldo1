import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContinuarSesion, tituloPaso } from "@/components/continuar-sesion";
import { Alerta, AvisoPrivacidad, CampoDigitos } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RespuestaLogin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { completarActivacion } from "@/lib/api/enlaces";
import { avisoQuery, useConsentimiento } from "@/lib/api/privacidad";

const msg = (e: unknown) => {
  if (!(e instanceof ApiError)) return "Algo salió mal. Intenta de nuevo.";
  if (e.codigo === "token_invalido") return "Pasaron más de 15 minutos. Vuelve a abrir el enlace o pide un código.";
  if (e.codigo === "codigo_invalido") return "El código no es correcto.";
  return e.message;
};

export function CompletarActivacion({ token, versionAvisoAceptada, onExpirado, onTitulo }: {
  token: string; versionAvisoAceptada?: string; onExpirado: (mensaje: string) => void; onTitulo?: (titulo: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<{ tipo: "formulario" } | { tipo: "ya_activa" } | { tipo: "sesion"; respuesta: RespuestaLogin; advertencias: string[] }>({ tipo: "formulario" });
  return <>
    {error && <Alerta>{error}</Alerta>}
    {paso.tipo === "formulario" && <Formulario token={token} versionAvisoAceptada={versionAvisoAceptada} onError={setError}
      onExpirado={onExpirado} onYaActiva={() => setPaso({ tipo: "ya_activa" })}
      onListo={(respuesta, advertencias) => { setError(null); setPaso({ tipo: "sesion", respuesta, advertencias }); }} />}
    {paso.tipo === "ya_activa" && <><Alerta tono="ok">Tu cuenta ya está activa.</Alerta><Button asChild size="lg" className="w-full"><Link to="/login">Ir a Entrar</Link></Button></>}
    {paso.tipo === "sesion" && <>
      {paso.advertencias.map((a) => <Alerta key={a} tono="aviso">{a}</Alerta>)}
      <ContinuarSesion respuesta={paso.respuesta} onPaso={(r) => onTitulo?.(tituloPaso(r))} onReiniciar={onExpirado} />
    </>}
  </>;
}

function Formulario({ token, versionAvisoAceptada, onError, onListo, onYaActiva, onExpirado }: {
  token: string; versionAvisoAceptada?: string | undefined; onError: (m: string | null) => void;
  onListo: (r: RespuestaLogin, adv: string[]) => void; onYaActiva: () => void; onExpirado: (m: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [acumulacion, setAcumulacion] = useState("");
  const [canje, setCanje] = useState("");
  const [correo, setCorreo] = useState("");
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [campo, setCampo] = useState<"pin" | "acum" | "canje" | null>("pin");
  const [cargando, setCargando] = useState(false);

  const vigente = useQuery(avisoQuery());
  const [invalidada, setInvalidada] = useState(false);
  const yaAceptada = !invalidada && !!versionAvisoAceptada && !vigente.isFetching && !vigente.isError && versionAvisoAceptada === vigente.data?.version;
  const versionEnviar = yaAceptada ? versionAvisoAceptada : version;
  const listo = pin.length === 6 && acumulacion.length === 4 && canje.length === 4 && (aviso || yaAceptada) && !!versionEnviar;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!listo || !versionEnviar) return onError("Completa el PIN, los dos códigos y acepta el aviso de privacidad.");
    setCargando(true);
    onError(null);
    try {
      const r = await completarActivacion({
        token_activacion: token, pin, codigo_acumulacion: acumulacion, codigo_canje: canje,
        correo: correo.trim() || null, acepta_aviso_privacidad: true,
        version_aviso: versionEnviar,
      });
      onListo(r.sesion, r.advertencias ?? []);
    } catch (err) {
      if (desactualizado(err)) { setInvalidada(true); return onError(err instanceof ApiError ? String(err.extras["message"] ?? err.message) : msg(err)); }
      if (err instanceof ApiError && err.codigo === "ya_activada") return onYaActiva();
      if (err instanceof ApiError && (err.codigo === "token_invalido" || err.codigo === "enlace_invalido")) return onExpirado(msg(err));
      onError(msg(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="rounded-xl bg-secondary p-3 text-sm">
        <p className="font-semibold">Vas a crear 3 claves:</p>
        <p><strong>PIN de acceso (6 dígitos):</strong> para entrar a Mi Saldo Vip.</p>
        <p><strong>PIN de acumulación (4 dígitos):</strong> se lo dices al cajero para que te sume saldo o sellos.</p>
        <p><strong>PIN de canje (4 dígitos):</strong> se lo dices al cajero para usar tu saldo o tus premios. No lo compartas.</p>
      </div>
      <CampoDigitos revelable etiqueta="PIN de acceso (6 dígitos)" ayuda="Con él entras a la app." valor={pin} onChange={setPin} largo={6}
        activo={campo === "pin"} onActivar={() => setCampo("pin")} />
      <CampoDigitos revelable etiquetaMostrar="PIN de acumulación (4 dígitos)" etiqueta="PIN de acumulación (4 dígitos)" ayuda="4 dígitos, por ejemplo 5821. Lo dices en caja para que te acumulen."
        valor={acumulacion} onChange={setAcumulacion} largo={4} activo={campo === "acum"} onActivar={() => setCampo("acum")} />
      <CampoDigitos revelable etiquetaMostrar="PIN de canje (4 dígitos)" etiqueta="PIN de canje (4 dígitos)" ayuda="4 dígitos, por ejemplo 7394. Solo tú lo conoces; protege tu saldo."
        valor={canje} onChange={setCanje} largo={4} activo={campo === "canje"} onActivar={() => setCampo("canje")} />
      <p className="text-sm text-muted-foreground">Evita secuencias (1234) y números repetidos (0000)</p>
      {acumulacion.length === 4 && canje === acumulacion && <Alerta tono="aviso">Tus PINes de acumulación (4 dígitos) y de canje (4 dígitos) son iguales.</Alerta>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="correo">Correo (opcional)</Label>
        <Input id="correo" type="email" autoComplete="email" className="h-12 text-lg" value={correo}
          onFocus={() => setCampo(null)} onChange={(e) => setCorreo(e.target.value)} />
      </div>
      {!yaAceptada && <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />}
      <Button type="submit" size="lg" disabled={cargando || !listo}>{cargando ? "Activando…" : "Activar mi cuenta"}</Button>
    </form>
  );
}

