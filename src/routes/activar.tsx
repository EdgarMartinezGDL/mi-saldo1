import { createFileRoute, Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ContinuarSesion, tituloPaso } from "@/components/continuar-sesion";
import { Alerta, AvisoPrivacidad, CampoDigitos, EnlaceNoValido, TarjetaEnlace, useTokenFragmento } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RespuestaLogin } from "@/lib/api/auth";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { completarActivacion, solicitarCodigoActivacion, verificarCodigoActivacion, verificarEnlaceActivacion } from "@/lib/api/enlaces";
import { useConsentimiento } from "@/lib/api/privacidad";

export const Route = createFileRoute("/activar")({
  head: () => ({
    meta: [
      { title: "Activar cuenta · MiSaldo" },
      { name: "description", content: "Activa tu cuenta de MiSaldo desde tu invitación." },
      { property: "og:title", content: "Activar cuenta · MiSaldo" },
      { property: "og:description", content: "Activa tu cuenta de MiSaldo desde tu invitación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Activar,
});

const msg = (e: unknown) => {
  if (!(e instanceof ApiError)) return "Algo salió mal. Intenta de nuevo.";
  if (e.codigo === "token_invalido") return "Pasaron más de 15 minutos. Vuelve a abrir el enlace o pide un código.";
  if (e.codigo === "codigo_invalido") return "El código no es correcto.";
  return e.message;
};

type Paso =
  | { tipo: "verificando" }
  | { tipo: "sin_enlace"; error?: string }
  | { tipo: "formulario"; token: string }
  | { tipo: "solicitar" }
  | { tipo: "codigo"; telefono: string }
  | { tipo: "ya_activa" }
  | { tipo: "sesion"; respuesta: RespuestaLogin; advertencias: string[] };

function Activar() {
  const token = useTokenFragmento();
  const [paso, setPaso] = useState<Paso>({ tipo: "verificando" });
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);

  useEffect(() => {
    if (token === undefined) return;
    if (token === null) return setPaso({ tipo: "sin_enlace" });
    verificarEnlaceActivacion(token)
      .then((r) => setPaso({ tipo: "formulario", token: r.token_activacion }))
      .catch((e) => setPaso({ tipo: "sin_enlace", error: msg(e) }));
  }, [token]);

  if (paso.tipo === "verificando") return <ExternalEntryLoading label="Estamos revisando tu enlace." />;

  return (
    <TarjetaEnlace titulo={titulo ?? "Activa tu cuenta"} icono={<UserCheck className="size-5" />}>
      {error && <Alerta>{error}</Alerta>}
      {paso.tipo === "sin_enlace" && (
        <>
          <EnlaceNoValido mensaje={paso.error ?? "Este enlace no es válido."} />
          <Button variant="link" className="mt-3 w-full" onClick={() => { setError(null); setPaso({ tipo: "solicitar" }); }}>
            ¿No tienes enlace? Pide un código
          </Button>
        </>
      )}
      {paso.tipo === "solicitar" && (
        <Solicitar onError={setError} onListo={(telefono) => { setError(null); setPaso({ tipo: "codigo", telefono }); }} />
      )}
      {paso.tipo === "codigo" && (
        <VerificarCodigo telefono={paso.telefono} onError={setError}
          onListo={(t) => { setError(null); setPaso({ tipo: "formulario", token: t }); }} />
      )}
      {paso.tipo === "formulario" && (
        <Formulario token={paso.token} onError={setError}
          onYaActiva={() => setPaso({ tipo: "ya_activa" })}
          onExpirado={(m) => setPaso({ tipo: "sin_enlace", error: m })}
          onListo={(respuesta, advertencias) => { setError(null); setPaso({ tipo: "sesion", respuesta, advertencias }); }} />
      )}
      {paso.tipo === "ya_activa" && (
        <>
          <Alerta tono="ok">Tu cuenta ya está activa.</Alerta>
          <Button asChild size="lg" className="w-full"><Link to="/login">Ir a Entrar</Link></Button>
        </>
      )}
      {paso.tipo === "sesion" && (
        <>
          {paso.advertencias.map((a) => <Alerta key={a} tono="aviso">{a}</Alerta>)}
          <ContinuarSesion respuesta={paso.respuesta} onPaso={(r) => setTitulo(tituloPaso(r))}
            onReiniciar={(m) => setPaso({ tipo: "sin_enlace", error: m })} />
        </>
      )}
    </TarjetaEnlace>
  );
}

function Formulario({ token, onError, onListo, onYaActiva, onExpirado }: {
  token: string; onError: (m: string | null) => void;
  onListo: (r: RespuestaLogin, adv: string[]) => void; onYaActiva: () => void; onExpirado: (m: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [acumulacion, setAcumulacion] = useState("");
  const [canje, setCanje] = useState("");
  const [correo, setCorreo] = useState("");
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [campo, setCampo] = useState<"pin" | "acum" | "canje" | null>("pin");
  const [cargando, setCargando] = useState(false);

  const listo = pin.length === 6 && acumulacion.length === 4 && canje.length === 4 && aviso && !!version;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!listo || !version) return onError("Completa el PIN, los dos códigos y acepta el aviso de privacidad.");
    setCargando(true);
    onError(null);
    try {
      const r = await completarActivacion({
        token_activacion: token, pin, codigo_acumulacion: acumulacion, codigo_canje: canje,
        correo: correo.trim() || null, acepta_aviso_privacidad: true,
        version_aviso: version,
      });
      onListo(r.sesion, r.advertencias ?? []);
    } catch (err) {
      if (desactualizado(err)) return onError(err instanceof ApiError ? String(err.extras["message"] ?? err.message) : msg(err));
      if (err instanceof ApiError && err.codigo === "ya_activada") return onYaActiva();
      if (err instanceof ApiError && (err.codigo === "token_invalido" || err.codigo === "enlace_invalido")) return onExpirado(msg(err));
      onError(msg(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <CampoDigitos etiqueta="Tu PIN (6 dígitos)" ayuda="Con él entras a la app." valor={pin} onChange={setPin} largo={6}
        activo={campo === "pin"} onActivar={() => setCampo("pin")} />
      <CampoDigitos etiqueta="Código de acumulación (4 dígitos)" ayuda="Lo dices en caja para que te acumulen."
        valor={acumulacion} onChange={setAcumulacion} largo={4} activo={campo === "acum"} onActivar={() => setCampo("acum")} />
      <CampoDigitos etiqueta="Código de canje (4 dígitos)" ayuda="Lo dices para canjear; no lo compartas."
        valor={canje} onChange={setCanje} largo={4} activo={campo === "canje"} onActivar={() => setCampo("canje")} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="correo">Correo (opcional)</Label>
        <Input id="correo" type="email" autoComplete="email" className="h-12 text-lg" value={correo}
          onFocus={() => setCampo(null)} onChange={(e) => setCorreo(e.target.value)} />
      </div>
      <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />
      <Button type="submit" size="lg" disabled={cargando || !listo}>{cargando ? "Activando…" : "Activar mi cuenta"}</Button>
    </form>
  );
}

function Solicitar({ onError, onListo }: { onError: (m: string | null) => void; onListo: (tel: string) => void }) {
  const [tel, setTel] = useState("");
  const [cargando, setCargando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (tel.replace(/\D/g, "").length !== 10) return onError("Escribe los 10 dígitos de tu teléfono.");
    setCargando(true);
    try {
      await solicitarCodigoActivacion(telefonoE164(tel));
      onListo(telefonoE164(tel));
    } catch (err) {
      onError(msg(err));
    } finally {
      setCargando(false);
    }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <p className="text-muted-foreground">Te enviaremos un código por WhatsApp si tu número está registrado.</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tel">Teléfono (10 dígitos)</Label>
        <Input id="tel" inputMode="numeric" autoComplete="tel" placeholder="55 1234 5678" className="h-12 text-lg"
          value={tel} onChange={(e) => setTel(e.target.value.replace(/[^\d ]/g, ""))} />
      </div>
      <Button type="submit" size="lg" disabled={cargando}>{cargando ? "Enviando…" : "Enviar código"}</Button>
    </form>
  );
}

function VerificarCodigo({ telefono, onError, onListo }: { telefono: string; onError: (m: string | null) => void; onListo: (t: string) => void }) {
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setCargando(true);
    try {
      const r = await verificarCodigoActivacion(telefono, codigo);
      onListo(r.token_activacion);
    } catch (err) {
      onError(msg(err));
    } finally {
      setCargando(false);
    }
  };
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <CampoDigitos etiqueta="Código que te llegó (6 dígitos)" valor={codigo} onChange={setCodigo} largo={6} activo onActivar={() => {}} />
      <Button type="submit" size="lg" disabled={cargando || codigo.length !== 6}>{cargando ? "Verificando…" : "Continuar"}</Button>
    </form>
  );
}
