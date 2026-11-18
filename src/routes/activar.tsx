import { createFileRoute, Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CompletarActivacion } from "@/components/completar-activacion";
import { Alerta, CampoDigitos, EnlaceNoValido, TarjetaEnlace, useTokenFragmento } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { solicitarCodigoActivacion, verificarCodigoActivacion, verificarEnlaceActivacion } from "@/lib/api/enlaces";

export const Route = createFileRoute("/activar")({
  head: () => ({
    meta: [
      { title: "Activar cuenta · Mi Saldo Vip" },
      { name: "description", content: "Activa tu cuenta de Mi Saldo Vip desde tu invitación." },
      { property: "og:title", content: "Activar cuenta · Mi Saldo Vip" },
      { property: "og:description", content: "Activa tu cuenta de Mi Saldo Vip desde tu invitación." },
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
  ;

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
        <CompletarActivacion token={paso.token} onTitulo={setTitulo}
          onExpirado={(m) => { setError(null); setTitulo(null); setPaso({ tipo: "sin_enlace", error: m }); }} />
      )}
    </TarjetaEnlace>
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
