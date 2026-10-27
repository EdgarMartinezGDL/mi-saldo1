import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ContinuarSesion, tituloPaso } from "@/components/continuar-sesion";
import { Alerta, AvisoPrivacidad, CampoDigitos, EnlaceNoValido, TarjetaEnlace, useTokenFragmento } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RespuestaLogin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { completarInvitacion, verificarInvitacion } from "@/lib/api/enlaces";
import { useConsentimiento } from "@/lib/api/privacidad";

export const Route = createFileRoute("/invitacion")({
  head: () => ({
    meta: [
      { title: "Invitación · MiSaldo" },
      { name: "description", content: "Abre tu invitación personal de MiSaldo." },
      { property: "og:title", content: "Invitación · MiSaldo" },
      { property: "og:description", content: "Abre tu invitación personal de MiSaldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invitacion,
});

const msg = (e: unknown) =>
  e instanceof ApiError
    ? e.codigo === "token_invalido" ? "Pasaron más de 15 minutos. Vuelve a abrir el enlace." : e.message
    : "Algo salió mal. Intenta de nuevo.";

type Datos = { token: string; nombre: string; negocio: string };
type Paso =
  | { tipo: "verificando" }
  | { tipo: "invalido"; error?: string }
  | { tipo: "formulario"; datos: Datos }
  | { tipo: "ya_activa" }
  | { tipo: "sesion"; respuesta: RespuestaLogin };

function Invitacion() {
  const token = useTokenFragmento();
  const [paso, setPaso] = useState<Paso>({ tipo: "verificando" });
  const [titulo, setTitulo] = useState<string | null>(null);

  useEffect(() => {
    if (token === undefined) return;
    if (token === null) return setPaso({ tipo: "invalido" });
    verificarInvitacion(token)
      .then((r) => setPaso({ tipo: "formulario", datos: { token: r.token_invitacion, nombre: r.nombre, negocio: r.negocio } }))
      .catch((e) => setPaso({ tipo: "invalido", error: msg(e) }));
  }, [token]);

  if (paso.tipo === "verificando") return <ExternalEntryLoading label="Estamos revisando tu invitación." />;

  return (
    <TarjetaEnlace titulo={titulo ?? "Tu invitación"} icono={<MailCheck className="size-5" />}>
      {paso.tipo === "invalido" && <EnlaceNoValido mensaje={paso.error} />}
      {paso.tipo === "formulario" && (
        <Formulario datos={paso.datos}
          onYaActiva={() => setPaso({ tipo: "ya_activa" })}
          onExpirado={(m) => setPaso({ tipo: "invalido", error: m })}
          onListo={(respuesta) => setPaso({ tipo: "sesion", respuesta })} />
      )}
      {paso.tipo === "ya_activa" && (
        <>
          <Alerta tono="ok">Tu cuenta ya está activa.</Alerta>
          <Button asChild size="lg" className="w-full"><Link to="/login">Ir a Entrar</Link></Button>
        </>
      )}
      {paso.tipo === "sesion" && (
        <ContinuarSesion respuesta={paso.respuesta} onPaso={(r) => setTitulo(tituloPaso(r))}
          onReiniciar={(m) => setPaso({ tipo: "invalido", error: m })} />
      )}
    </TarjetaEnlace>
  );
}

function Formulario({ datos, onListo, onYaActiva, onExpirado }: {
  datos: Datos; onListo: (r: RespuestaLogin) => void; onYaActiva: () => void; onExpirado: (m: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [correo, setCorreo] = useState("");
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [campo, setCampo] = useState<"pin" | "pin2" | null>("pin");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const listo = pin.length === 6 && pin2.length === 6 && correoOk && aviso && !!version;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (pin !== pin2) return setError("Los dos PIN no coinciden.");
    if (!correoOk) return setError("Escribe un correo válido.");
    if (!listo || !version) return setError("Completa los datos y acepta el aviso de privacidad.");
    setCargando(true);
    setError(null);
    try {
      const r = await completarInvitacion({ token_invitacion: datos.token, pin, correo: correo.trim(), acepta_aviso_privacidad: true, version_aviso: version });
      onListo(r.sesion);
    } catch (err) {
      if (desactualizado(err)) return setError(err instanceof ApiError ? String(err.extras["message"] ?? err.message) : msg(err));
      if (err instanceof ApiError && err.codigo === "ya_activada") return onYaActiva();
      if (err instanceof ApiError && (err.codigo === "token_invalido" || err.codigo === "enlace_invalido")) return onExpirado(msg(err));
      setError(msg(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <p className="text-lg font-medium">Hola {datos.nombre}, te invitaron a {datos.negocio}.</p>
      {error && <Alerta>{error}</Alerta>}
      <CampoDigitos etiqueta="Crea tu PIN (6 dígitos)" valor={pin} onChange={setPin} largo={6}
        activo={campo === "pin"} onActivar={() => setCampo("pin")} />
      <CampoDigitos etiqueta="Repite tu PIN" valor={pin2} onChange={setPin2} largo={6}
        activo={campo === "pin2"} onActivar={() => setCampo("pin2")} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" type="email" autoComplete="email" className="h-12 text-lg" value={correo}
          onFocus={() => setCampo(null)} onChange={(e) => setCorreo(e.target.value)} />
        <p className="text-xs text-muted-foreground">Sirve para recuperar tu acceso.</p>
      </div>
      <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />
      <Button type="submit" size="lg" disabled={cargando || !listo}>{cargando ? "Creando…" : "Crear mi acceso"}</Button>
    </form>
  );
}
