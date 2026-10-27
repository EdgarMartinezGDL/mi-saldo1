import { createFileRoute } from "@tanstack/react-router";
import { UserRoundSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alerta, EnlaceNoValido, fechaLarga, TarjetaEnlace, useTokenFragmento } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import {
  confirmarValidacionEnlace, consultarValidacionEnlace, rechazarValidacionEnlace,
  textoEstado, textoResultado, textoSolicitud, type Validacion,
} from "@/lib/api/enlaces";

export const Route = createFileRoute("/confirmar-alta")({
  head: () => ({
    meta: [
      { title: "Confirmar alta · MiSaldo" },
      { name: "description", content: "Confirma una solicitud de alta en MiSaldo." },
      { property: "og:title", content: "Confirmar alta · MiSaldo" },
      { property: "og:description", content: "Confirma una solicitud de alta en MiSaldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmarAlta,
});

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo.");

function ConfirmarAlta() {
  const token = useTokenFragmento();
  const guardado = useRef<string | null>(null); // token kept in memory only, no longer in the URL
  const [validacion, setValidacion] = useState<Validacion | null>(null);
  const [invalido, setInvalido] = useState<string | null | undefined>(undefined);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    if (token === null) return setInvalido("Este enlace no es válido.");
    guardado.current = token;
    consultarValidacionEnlace(token)
      .then((v) => { setValidacion(v); setInvalido(null); })
      .catch((e) => setInvalido(msg(e)));
  }, [token]);

  const responder = async (fn: typeof confirmarValidacionEnlace) => {
    if (!guardado.current || !validacion) return;
    setCargando(true);
    setError(null);
    try {
      const r = await fn(guardado.current);
      setResultado(textoResultado(r, validacion.negocio.nombre_comercial));
      guardado.current = null;
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "enlace_invalido") setInvalido(e.message);
      else setError(msg(e));
    } finally {
      setCargando(false);
    }
  };

  if (invalido === undefined) return <ExternalEntryLoading label="Estamos revisando la solicitud." />;

  return (
    <TarjetaEnlace titulo="¿Eres tú?" icono={<UserRoundSearch className="size-5" />}>
      {invalido ? <EnlaceNoValido mensaje={invalido} /> : validacion && (
        resultado ? <Alerta tono="ok">{resultado}</Alerta> : (
          <div className="flex flex-col gap-4">
            <p className="text-lg font-medium">{textoSolicitud(validacion)}.</p>
            {validacion.estado === "pendiente" ? (
              <>
                <p className="text-sm text-muted-foreground">Vence el {fechaLarga(validacion.expira_en)}</p>
                {error && <Alerta>{error}</Alerta>}
                <Button size="lg" disabled={cargando} onClick={() => void responder(confirmarValidacionEnlace)}>Sí, soy yo</Button>
                <Button size="lg" variant="outline" disabled={cargando} onClick={() => void responder(rechazarValidacionEnlace)}>No soy yo</Button>
              </>
            ) : (
              <Alerta tono="aviso">{textoEstado[validacion.estado]}</Alerta>
            )}
          </div>
        )
      )}
    </TarjetaEnlace>
  );
}
