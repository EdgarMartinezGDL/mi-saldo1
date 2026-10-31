import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, RefreshCw } from "lucide-react";
import { RequiereSesion } from "@/components/requiere-sesion";
import { AppShell } from "@/components/app-shell";
import { Alerta, TarjetaEnlace } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { AvisoPagoPrueba } from "@/components/pago-comun";
import { consultarSuscripcion, errorSuscripcion, intervaloSuscripcion, verificarSuscripcion } from "@/lib/api/pagos";
import { fechaAviso } from "@/lib/api/privacidad";
import { pesos } from "@/lib/api/formato";

export const Route = createFileRoute("/membresia/domiciliado")({
  validateSearch: (s: Record<string, unknown>): { resultado: "cancelado" | "ok" } => ({ resultado: s["resultado"] === "cancelado" ? "cancelado" : "ok" }),
  head: () => ({ meta: [
    { title: "Pago domiciliado · MiSaldo" }, { name: "description", content: "Estado de tu pago domiciliado de la membresía MiSaldo." },
    { property: "og:title", content: "Pago domiciliado · MiSaldo" }, { property: "og:description", content: "Estado de tu pago domiciliado de la membresía MiSaldo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequiereSesion titulo="Pago domiciliado" roles={["dueno"]}><AppShell><RegresoDomiciliado /></AppShell></RequiereSesion>,
});

function RegresoDomiciliado() {
  const { resultado } = Route.useSearch();
  return <TarjetaEnlace titulo="Pago domiciliado" icono={<RefreshCw className="size-5" />}>
    {resultado === "cancelado" ? <div className="flex flex-col gap-4"><p>No se guardó tu tarjeta. Puedes intentarlo de nuevo cuando quieras.</p>
      <Button asChild variant="secondary"><Link to="/negocio/membresia">Volver a Membresía</Link></Button>
    </div> : <ConfirmacionDomiciliado />}
  </TarjetaEnlace>;
}

function ConfirmacionDomiciliado() {
  const client = useQueryClient();
  const [inicio] = useState(() => Date.now());
  const [esperaTerminada, setEsperaTerminada] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const iniciado = useRef(false);
  const datos = useQuery({ queryKey: ["membresia-suscripcion"], queryFn: consultarSuscripcion, enabled: verificado, gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: false, refetchInterval: (q) => intervaloSuscripcion(q.state.data?.suscripcion?.estado, inicio, Date.now()),
  });
  const verificar = useMutation({ mutationFn: verificarSuscripcion,
    onSuccess: (r) => client.setQueryData(["membresia-suscripcion"], r), onSettled: () => setVerificado(true),
  });
  useEffect(() => {
    if (!iniciado.current) { iniciado.current = true; verificar.mutate(); }
    const timer = window.setTimeout(() => setEsperaTerminada(true), Math.max(0, 60_000 - (Date.now() - inicio)));
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio]);
  const s = datos.data?.suscripcion;
  useEffect(() => {
    if (s?.estado !== "activa") return;
    void client.invalidateQueries({ queryKey: ["membresia"] });
    void client.invalidateQueries({ queryKey: ["membresia-metodos"] });
    void client.invalidateQueries({ queryKey: ["pagos-membresia"] });
  }, [s?.estado, client]);
  const volver = <Button asChild variant="secondary"><Link to="/negocio/membresia">Volver a Membresía</Link></Button>;
  const posterior = s ? s.primer_cobro.slice(0, 10) > new Date().toISOString().slice(0, 10) : false;
  return <div className="flex flex-col gap-4">
    {s?.prueba && <AvisoPagoPrueba />}
    {verificar.error && <Alerta>{errorSuscripcion(verificar.error)}</Alerta>}
    {datos.isError && <Alerta>{errorSuscripcion(datos.error)}</Alerta>}
    {(!verificado || datos.isPending || s?.estado === "creada") && <>
      <p>{esperaTerminada && s?.estado === "creada" ? "Aún no recibimos la confirmación de Stripe." : "Estamos confirmando con Stripe…"}</p>
      {esperaTerminada && s?.estado === "creada" && <Button disabled={verificar.isPending} onClick={() => verificar.mutate()}>Ya terminé</Button>}
    </>}
    {s?.estado === "activa" && <>
      <CircleCheck className="size-12 text-success" /><h2 className="text-2xl font-semibold">¡Tu tarjeta quedó domiciliada!</h2>
      {s.tarjeta && <p>{s.tarjeta.marca} terminación {s.tarjeta.ultimos4}</p>}
      <p>{posterior ? `El primer cargo de ${pesos(s.precio_mensual_centavos)} ${s.moneda} será el ${fechaAviso(s.primer_cobro)} y después cada mes.` : "Ya cobramos tu primer mes. Te enviamos la confirmación por WhatsApp y correo."}</p>
      {volver}
    </>}
    {s?.estado === "pago_pendiente" && <><Alerta>Guardamos tu tarjeta, pero no pudimos cobrar el primer mes. Stripe lo volverá a intentar.</Alerta>{volver}</>}
    {verificado && !datos.isPending && (!s || ["vencida", "cancelada", "duplicada"].includes(s.estado)) && <><p>Este intento ya no está vigente.</p>{volver}</>}
  </div>;
}