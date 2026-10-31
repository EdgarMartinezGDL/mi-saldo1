import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { Alerta } from "./enlace-ui";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { useConTotp } from "./totp-provider";
import { ApiError } from "@/lib/api/client";
import { cancelarSuscripcion, consultarSuscripcion, crearSuscripcion, errorSuscripcion, estadosPago, reanudarSuscripcion, verificarSuscripcion } from "@/lib/api/pagos";
import { pesos } from "@/lib/api/formato";
import { fechaAviso } from "@/lib/api/privacidad";

export function Domiciliado({ precioMensualCentavos, moneda }: { precioMensualCentavos: number; moneda: string }) {
  const client = useQueryClient();
  const conTotp = useConTotp();
  const datos = useQuery({ queryKey: ["membresia-suscripcion"], queryFn: consultarSuscripcion, gcTime: 0, staleTime: 0, retry: false });
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const llave = useRef<string | null>(null);
  const enviando = useRef(false);
  const s = datos.data?.suscripcion;
  const cobros = datos.data?.cobros ?? [];
  const invalidar = () => {
    void client.invalidateQueries({ queryKey: ["membresia"] });
    void client.invalidateQueries({ queryKey: ["pagos-membresia"] });
  };
  const fallo = (e: unknown) => { if (!(e instanceof ApiError && e.codigo === "totp_cancelado")) setError(errorSuscripcion(e)); };
  const crear = useMutation({ mutationFn: crearSuscripcion, onSuccess: (r) => {
    client.setQueryData(["membresia-suscripcion"], { suscripcion: r.suscripcion, cobros });
    invalidar(); llave.current = null;
    if (r.suscripcion.url_pago) window.location.assign(r.suscripcion.url_pago);
    else enviando.current = false;
  }, onError: (e) => {
    enviando.current = false;
    if (e instanceof ApiError && e.status === 409 && e.codigo === "ya_suscrito") { void datos.refetch(); return; }
    fallo(e);
  } });
  const verificar = useMutation({ mutationFn: verificarSuscripcion, onSuccess: (r) => client.setQueryData(["membresia-suscripcion"], r), onError: fallo });
  const cancelar = useMutation({ mutationFn: () => conTotp(() => cancelarSuscripcion()), onSuccess: (r) => {
    client.setQueryData(["membresia-suscripcion"], { suscripcion: r.suscripcion, cobros });
    setConfirmando(false); invalidar();
  }, onError: fallo });
  const reanudar = useMutation({ mutationFn: () => conTotp(() => reanudarSuscripcion()), onSuccess: (r) => {
    client.setQueryData(["membresia-suscripcion"], { suscripcion: r.suscripcion, cobros }); invalidar();
  }, onError: fallo });
  const fechaFin = s?.periodo_fin ? fechaAviso(s.periodo_fin) : "";
  return <div className="flex flex-col gap-3 p-2 pt-3">
    {error && <Alerta>{error}</Alerta>}
    {datos.isPending ? <p>Estamos confirmando con Stripe…</p> : datos.isError ? <Alerta>{errorSuscripcion(datos.error)}</Alerta> : <>
      {(!s || ["vencida", "cancelada", "duplicada"].includes(s.estado)) && <>
        {s?.estado === "cancelada" && <p>Tu pago domiciliado terminó.</p>}
        <p>Guardaremos tu tarjeta en Stripe y se cobrará {pesos(precioMensualCentavos)} {moneda} cada mes. Puedes cancelarlo cuando quieras, sin perder lo que ya pagaste.</p>
        <Button disabled={crear.isPending || enviando.current} onClick={() => {
          if (enviando.current) return;
          enviando.current = true; setError(null);
          llave.current ??= crypto.randomUUID(); crear.mutate(llave.current);
        }}>{crear.isPending ? "Preparando…" : "Domiciliar mi tarjeta"}</Button>
      </>}
      {s?.estado === "creada" && <>
        <p>Aún no terminas de guardar tu tarjeta.</p>
        <Button disabled={!s.url_pago} onClick={() => { if (s.url_pago) window.location.assign(s.url_pago); }}>Continuar</Button>
        <Button variant="secondary" disabled={verificar.isPending} onClick={() => { setError(null); verificar.mutate(); }}>Ya terminé</Button>
      </>}
      {s && (s.estado === "activa" || s.estado === "pago_pendiente") && <>
        {s.estado === "pago_pendiente" && <Alerta>No pudimos cobrar tu tarjeta. Stripe lo volverá a intentar en los próximos días. Tu membresía no se ha renovado.</Alerta>}
        {s.cancelar_al_final ? <>
          <p>Tu domiciliado se cancela el {fechaFin}. Hasta entonces tu membresía sigue pagada.</p>
          <Button disabled={reanudar.isPending} onClick={() => { setError(null); reanudar.mutate(); }}>Reanudar domiciliado</Button>
        </> : <>
          <p className="flex items-center gap-2 font-semibold"><CircleCheck className="size-5 text-success" />Pago domiciliado activo</p>
          {s.tarjeta && <p>{s.tarjeta.marca ? s.tarjeta.marca.charAt(0).toUpperCase() + s.tarjeta.marca.slice(1) : ""} terminación {s.tarjeta.ultimos4}</p>}
          <p>{pesos(s.precio_mensual_centavos)} {s.moneda} al mes</p>
          <p>Próximo cargo: {fechaFin}</p>
          <Button variant="secondary" disabled={cancelar.isPending} onClick={() => { setError(null); setConfirmando(true); }}>Cancelar domiciliado</Button>
        </>}
      </>}
      {cobros.length > 0 && <div><h3 className="text-base font-semibold">Cobros del domiciliado</h3>
        <ul className="mt-2 divide-y divide-border">{cobros.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="text-sm">{fechaAviso(p.creado_en)} · {pesos(p.monto_centavos)} {p.moneda}</span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{estadosPago[p.estado]}</span>
        </li>)}</ul>
      </div>}
    </>}
    <Dialog open={confirmando} onOpenChange={(o) => { if (!cancelar.isPending) setConfirmando(o); }}>
      <DialogContent><DialogHeader><DialogTitle>¿Cancelar el pago domiciliado?</DialogTitle>
        <DialogDescription>Ya no se cobrará cada mes. Tu membresía sigue pagada hasta el {fechaFin} y puedes reanudarlo antes de esa fecha.</DialogDescription>
      </DialogHeader><DialogFooter className="gap-2">
        <Button variant="secondary" disabled={cancelar.isPending} onClick={() => setConfirmando(false)}>No</Button>
        <Button disabled={cancelar.isPending} onClick={() => { setError(null); cancelar.mutate(); }}>Sí, cancelar</Button>
      </DialogFooter></DialogContent>
    </Dialog>
  </div>;
}