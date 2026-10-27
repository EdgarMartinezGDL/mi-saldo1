import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { RequiereSesion } from "@/components/requiere-sesion";
import { Alerta, TarjetaEnlace } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { FichaOxxo } from "@/components/pago-comun";
import { errorPago, pagoSimulado, pagarSimulado, pagarOxxoSimulado, type ResultadoSimulado } from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/client";
import { pesos } from "@/lib/api/formato";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/pago-simulado/$id")({ head: () => ({ meta: [
  { title: "Pago simulado · MiSaldo" }, { name: "description", content: "Prueba el pago de membresía MiSaldo sin realizar ningún cobro real." },
  { property: "og:title", content: "Pago simulado · MiSaldo" }, { property: "og:description", content: "Simulador de tarjeta y OXXO para MiSaldo." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: () => <RequiereSesion titulo="Pago simulado" roles={["dueno"]}><Simulador /></RequiereSesion> });

function Simulador() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const datos = useQuery({ queryKey: ["pago-simulado", id], queryFn: () => pagoSimulado(id), retry: false, gcTime: 0 });
  const [fallo, setFallo] = useState<unknown>(null);
  const [ficha, setFicha] = useState<ResultadoSimulado["pago_simulado"]["datos"]["oxxo"]>();
  const regresar = () => navigate({ to: "/membresia/pago/$id", params: { id } });
  const accion = useMutation({
    mutationFn: (tipo: "aprobar" | "rechazar" | "ficha" | "tienda") => tipo === "tienda" ? pagarOxxoSimulado(id) : pagarSimulado(id, tipo === "aprobar" ? "aprobado" : tipo === "rechazar" ? "rechazado" : undefined),
    onSuccess: (r, tipo) => {
      if (tipo === "ficha") { setFicha(r.pago_simulado.datos.oxxo); void client.invalidateQueries({ queryKey: ["pago-simulado", id] }); }
      else { void client.invalidateQueries({ queryKey: ["pago-membresia", id] }); void regresar(); }
    }, onError: setFallo,
  });
  const error = fallo ?? datos.error;
  const noDisponible = (error instanceof ApiError && error.status === 404) || (datos.data && (!datos.data.simulador || !datos.data.pago.simulado));
  const p = datos.data?.pago;
  const ejecutar = (tipo: "aprobar" | "rechazar" | "ficha" | "tienda") => { if (accion.isPending) return; setFallo(null); accion.mutate(tipo); };
  return <>
    <div role="alert" className="fixed inset-x-0 top-0 z-40 bg-warn p-3 text-center font-semibold text-background">PAGO SIMULADO — ningún cobro es real</div>
    <TarjetaEnlace titulo="Pago simulado" icono={<CreditCard className="size-5" />}>
      {noDisponible ? <><Alerta>Esta página de prueba no está disponible.</Alerta><Button asChild variant="secondary"><Link to="/negocio/membresia">Volver a Membresía</Link></Button></> : <div className="flex flex-col gap-4">
        {error && <><Alerta>{errorPago(error)}</Alerta><Button asChild variant="secondary"><Link to="/membresia/pago/$id" params={{ id }}>Ver mi pago</Link></Button></>}
        {datos.isPending ? <p>Cargando pago…</p> : p && <>
          <h2 className="text-xl font-semibold">Membresía MiSaldo · {plural(p.meses, "mes", "meses")}</h2>
          <p className="font-mono text-2xl font-bold">{pesos(p.monto_centavos, p.moneda)} {p.moneda}</p>
          <p>{p.metodo === "tarjeta" ? "Tarjeta de crédito o débito" : "Efectivo en OXXO"}</p>
          {p.metodo === "tarjeta" ? <><Button disabled={accion.isPending} onClick={() => ejecutar("aprobar")}>Pagar {pesos(p.monto_centavos, p.moneda)}</Button><Button variant="secondary" disabled={accion.isPending} onClick={() => ejecutar("rechazar")}>Simular tarjeta rechazada</Button></> : <>
            {p.estado === "creado" && !ficha ? <Button disabled={accion.isPending} onClick={() => ejecutar("ficha")}>Generar ficha de pago</Button> : <>
              <FichaOxxo ficha={ficha ?? p.datos_pago.oxxo} />
              <Button disabled={accion.isPending} onClick={() => ejecutar("tienda")}>Simular pago en la tienda</Button>
              <Button variant="secondary" disabled={accion.isPending} onClick={() => void regresar()}>Pagaré después</Button>
            </>}
          </>}
        </>}
      </div>}
    </TarjetaEnlace>
  </>;
}