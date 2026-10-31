import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CircleCheck, CreditCard } from "lucide-react";
import { RequiereSesion } from "@/components/requiere-sesion";
import { AppShell } from "@/components/app-shell";
import { Alerta, TarjetaEnlace } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { AvisoPagoPrueba, FichaOxxo } from "@/components/pago-comun";
import { pagoMembresia, verificarPago, errorPago, intervaloPago } from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/client";
import { fechaAviso } from "@/lib/api/privacidad";
import { pesos } from "@/lib/api/formato";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/membresia/pago/$id")({ head: () => ({ meta: [
  { title: "Estado de tu pago · MiSaldo" }, { name: "description", content: "Consulta tu pago en línea y la renovación de tu membresía MiSaldo." },
  { property: "og:title", content: "Estado de tu pago · MiSaldo" }, { property: "og:description", content: "Confirmación y seguimiento de pagos de membresía MiSaldo." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: () => <RequiereSesion titulo="Pago de membresía" roles={["dueno"]}><AppShell><RegresoPago /></AppShell></RequiereSesion> });

function RegresoPago() {
  const { id } = Route.useParams();
  const client = useQueryClient();
  const [inicio, setInicio] = useState(() => Date.now());
  useEffect(() => { setInicio(Date.now()); }, [id]);
  const datos = useQuery({ queryKey: ["pago-membresia", id], queryFn: () => pagoMembresia(id), retry: false, gcTime: 0,
    refetchInterval: (q) => intervaloPago(q.state.data?.pago.estado, inicio, Date.now()), refetchOnWindowFocus: false,
  });
  const verificar = useMutation({ mutationFn: () => verificarPago(id), onSuccess: (r) => client.setQueryData(["pago-membresia", id], r) });
  const p = datos.data?.pago;
  useEffect(() => {
    if (p?.estado !== "aprobado") return;
    void client.invalidateQueries({ queryKey: ["membresia-pago"] });
    void client.invalidateQueries({ queryKey: ["membresia"] });
    void client.invalidateQueries({ queryKey: ["pagos-membresia"] });
  }, [p?.estado, client]);
  const ir = (titulo: string) => p?.url_pago && <Button onClick={() => { if (p.url_pago) window.location.assign(p.url_pago); }}>{titulo}</Button>;
  const volver = (titulo = "Volver a Membresía") => <Button asChild variant="secondary"><Link to="/negocio/membresia">{titulo}</Link></Button>;
  const yaPague = <Button variant="secondary" disabled={verificar.isPending} onClick={() => verificar.mutate()}>Ya pagué</Button>;
  return <TarjetaEnlace titulo="Pago de membresía" icono={<CreditCard className="size-5" />}>
    {datos.isPending ? <p>Cargando pago…</p> : datos.isError ? <><Alerta>{datos.error instanceof ApiError && datos.error.status === 404 ? "No encontramos este pago." : errorPago(datos.error)}</Alerta>{volver()}</> : p && <div className="flex flex-col gap-4">
      {(p.simulado || p.prueba) && <AvisoPagoPrueba />}
      <h2 className="text-lg font-semibold">Membresía MiSaldo · {plural(p.meses, "mes", "meses")} · {pesos(p.monto_centavos, p.moneda)} {p.moneda}</h2>
      {verificar.error && <Alerta>{errorPago(verificar.error)}</Alerta>}
      {p.estado === "creado" && <><p>Aún no recibimos tu pago.</p>{ir("Ir a pagar")}{yaPague}</>}
      {p.estado === "pendiente" && <>{p.metodo === "oxxo" ? <><FichaOxxo ficha={p.datos_pago.oxxo} /><p className="text-sm">Tu membresía se renueva cuando OXXO confirme el pago (puede tardar hasta 1 hora).</p>{p.simulado && ir("Simular pago en la tienda")}</> : <p>Aún no recibimos tu pago.</p>}{yaPague}</>}
      {p.estado === "aprobado" && <><CircleCheck className="size-12 text-success" /><h3 className="text-2xl font-semibold">¡Pago recibido!</h3><p>Tu membresía vence el {fechaAviso(datos.data.membresia.fecha_vencimiento)}.</p><p className="text-sm">Te enviamos la confirmación por WhatsApp y correo.</p>{volver()}</>}
      {p.estado === "rechazado" && <><Alerta>Tu pago fue rechazado.</Alerta>{ir("Intentar de nuevo")}</>}
      {(p.estado === "vencido" || p.estado === "cancelado") && <><p>Esta orden venció.</p>{volver("Crear otro pago")}</>}
      {p.estado === "en_revision" && <p>Recibimos tu pago, pero necesita una revisión. Soporte te contactará.</p>}
    </div>}
  </TarjetaEnlace>;
}