import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api/client";
import { aCentavos, fechaCorta, instante, pesos } from "@/lib/api/formato";
import {
  detalleNegocioStaff,
  extenderPrueba,
  registrarPagoMembresia,
  type DetalleNegocioStaff,
  type EstadoMembresia,
  type MovimientoMembresia,
} from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { useNivelStaff, useStaffNav } from "./comun";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { AvisoPrueba } from "./portafolios";
import { BloqueDueno, PlanNegocio } from "./plan-negocio";
import { plural } from "@/lib/plural";

type Estados = Record<EstadoMembresia, { l: string; c: string }>;

const MSG_PAGO: Record<string, string> = {
  meses_invalidos: "Los meses deben ser de 1 a 24.",
  monto_invalido: "Revisa el monto.",
  referencia_invalida: "La referencia debe tener hasta 150 caracteres.",
  sin_permiso: "Solo un administrador de Staff puede registrar pagos.",
  no_encontrado: "Este negocio ya no existe.",
};
const MSG_PRUEBA: Record<string, string> = {
  ya_pago: "Este negocio ya pagó alguna vez: registra un pago en lugar de extender la prueba.",
  negocio_suspendido: "Reactiva el negocio antes de extender la prueba.",
  dias_invalidos: "Los días deben ser de 1 a 90.",
  sin_permiso: "Solo un administrador de Staff puede extender pruebas.",
  no_encontrado: "Este negocio ya no existe.",
};

export const lineaAviso = (m: { estado: EstadoMembresia; aviso_pago_pendiente: boolean; bloqueo_desde?: string | null }) => {
  if (!m.aviso_pago_pendiente) return null;
  if (m.estado === "vencida") return `Caja bloqueada desde el ${fechaCorta(m.bloqueo_desde)}`;
  return `Pago pendiente · la caja se bloquea el ${fechaCorta(m.bloqueo_desde)}`;
};

const nombreStaff = (s: MovimientoMembresia["staff"]) => s ?? "—";

function textoMovimiento(m: MovimientoMembresia) {
  if (m.tipo === "extension_manual")
    return `Pago · ${plural(m.meses_agregados ?? 0, "mes", "meses")} · ${pesos(m.monto_centavos)} · ${m.referencia_pago ?? ""}`;
  if (m.tipo === "prueba_gratuita") return `Prueba · ${m.dias_agregados ?? 0} días`;
  return "Pago automático";
}

export function DetalleNegocio({
  negocioId,
  estados,
  onCerrar,
  onCambio,
}: {
  negocioId: string | null;
  estados: Estados;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const movil = useIsMobile();
  const conTotp = useConTotp();
  const { esAdmin } = useNivelStaff();
  const { verAuditoria } = useStaffNav();
  const [d, setD] = useState<DetalleNegocioStaff | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ocultarPrueba, setOcultarPrueba] = useState(false);
  // Pago
  const [meses, setMeses] = useState("1");
  const [monto, setMonto] = useState("");
  const [ref, setRef] = useState("");
  const [confPago, setConfPago] = useState(false);
  // Prueba
  const [dias, setDias] = useState("7");
  const [confPrueba, setConfPrueba] = useState(false);
  const refContenido = useDesplazarAlAbrir<HTMLDivElement>(negocioId);

  const cargar = async (id: string) => {
    try {
      setD(await detalleNegocioStaff(id));
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "no_encontrado") {
        toast.error("Este negocio ya no existe.");
        onCerrar();
        onCambio();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo.");
    }
  };

  useEffect(() => {
    setD(null);
    setOcultarPrueba(false);
    setMeses("1");
    setMonto("");
    setRef("");
    setDias("7");
    if (negocioId) void cargar(negocioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  const nMeses = Number(meses);
  const mesesOk = /^\d+$/.test(meses) && nMeses >= 1 && nMeses <= 24;
  const centavos = aCentavos(monto);
  const refOk = ref.length >= 3 && ref.length <= 150 && ref === ref.trim();
  const pagoOk = mesesOk && centavos > 0 && refOk;
  const nDias = Number(dias);
  const diasOk = /^\d+$/.test(dias) && nDias >= 1 && nDias <= 90;

  const manejarError = (e: unknown, mapa: Record<string, string>) => {
    if (!(e instanceof ApiError) || e.status === 0) {
      toast.error("No sabemos si se registró. Revisa el historial antes de volver a intentarlo");
      if (negocioId) void cargar(negocioId);
      return;
    }
    if (e.codigo === "totp_cancelado") return;
    if (e.codigo === "no_encontrado") {
      toast.error(mapa["no_encontrado"]);
      onCerrar();
      onCambio();
      return;
    }
    if (e.codigo === "ya_pago") setOcultarPrueba(true);
    toast.error((e.codigo && mapa[e.codigo]) || e.message);
  };

  const registrar = async () => {
    if (!d || ocupado) return;
    setOcupado(true);
    setConfPago(false);
    try {
      const r = await conTotp(() =>
        registrarPagoMembresia(d.negocio_id, { meses: nMeses, monto_centavos: centavos, referencia_pago: ref }),
      );
      toast.success("Pago registrado", {
        description: `${d.nombre_comercial} vence el ${fechaCorta(r.fecha_vencimiento)}. Avisamos al dueño por WhatsApp.`,
      });
      setMeses("1");
      setMonto("");
      setRef("");
      await cargar(d.negocio_id);
      onCambio();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 0) {
        toast.error("No sabemos si el pago se registró. Revisa el historial antes de volver a intentarlo");
        void cargar(d.negocio_id);
      } else manejarError(e, MSG_PAGO);
    } finally {
      setOcupado(false);
    }
  };

  const extender = async () => {
    if (!d || ocupado) return;
    setOcupado(true);
    setConfPrueba(false);
    try {
      const r = await conTotp(() => extenderPrueba(d.negocio_id, nDias));
      toast.success("Prueba extendida", { description: `Ahora vence el ${fechaCorta(r.fecha_vencimiento)}.` });
      setDias("7");
      await cargar(d.negocio_id);
      onCambio();
    } catch (e) {
      manejarError(e, MSG_PRUEBA);
    } finally {
      setOcupado(false);
    }
  };

  const m = d?.membresia;
  const vencido = m ? m.dias_para_vencer < 0 : false;
  const aviso = m ? lineaAviso(m) : null;
  const mostrarPrueba = esAdmin && d && m && !d.membresia_pagada && d.activo && !ocultarPrueba;

  return (
    <Sheet open={!!negocioId} onOpenChange={(o) => !o && !ocupado && onCerrar()}>
      <SheetContent
        side={movil ? "bottom" : "right"}
        className={cn("overflow-y-auto overflow-x-hidden", movil ? "max-h-[90dvh] rounded-t-2xl pb-28" : "w-full sm:max-w-md")}
      >
        {!d || !m ? (
          <>
            <SheetHeader>
              <SheetTitle>Detalle del negocio</SheetTitle>
              <SheetDescription>Cargando…</SheetDescription>
            </SheetHeader>
            <Cargando />
          </>
        ) : (
          <div ref={refContenido} className="flex min-w-0 flex-col gap-6">
            <SheetHeader className="text-left">
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-8 text-xl">
                <span className="min-w-0 break-words">{d.nombre_comercial}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", estados[m.estado].c)}>
                  {estados[m.estado].l}
                </span>
              </SheetTitle>
              <SheetDescription className="text-sm">
                {vencido
                  ? `Venció el ${fechaCorta(m.fecha_vencimiento)}`
                  : `Vigente del ${fechaCorta(m.fecha_inicio)} al ${fechaCorta(m.fecha_vencimiento)}`}
              </SheetDescription>
              {aviso && <p className="text-sm font-medium text-warn">{aviso}</p>}
              {!d.activo && (
                <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  Negocio suspendido: el pago se registra, pero el negocio sigue suspendido hasta que lo reactives.
                </p>
              )}
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <AvisoPrueba negocioId={d.negocio_id} texto="Probar su WhatsApp" />
              {esAdmin && (
                <Button variant="link" onClick={() => { onCerrar(); verAuditoria({ negocio_id: d.negocio_id, etiqueta: d.nombre_comercial }); }}>Ver en la auditoría</Button>
              )}
            </div>

            <BloqueDueno d={d} admin={esAdmin} />

            {esAdmin && (
            <fieldset disabled={ocupado} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <h3 className="text-base font-semibold">Registrar pago</h3>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-meses">Meses</Label>
                <div className="flex flex-wrap gap-2">
                  {["1", "3", "6", "12"].map((v) => (
                    <Rapido key={v} activo={meses === v} onClick={() => setMeses(v)}>{v}</Rapido>
                  ))}
                  <Input id="p-meses" inputMode="numeric" className="h-11 w-20" value={meses}
                    onChange={(e) => setMeses(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-monto">Monto recibido</Label>
                <Input id="p-monto" inputMode="decimal" placeholder="299.00" className="h-11" value={monto}
                  onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-ref">Referencia del pago</Label>
                <Input id="p-ref" maxLength={150} placeholder="SPEI 0123456789 o folio OXXO" className="h-11" value={ref}
                  onChange={(e) => setRef(e.target.value)} />
              </div>
              <p className="text-sm text-muted-foreground">
                {vencido
                  ? "Ya venció: los meses se cuentan desde hoy."
                  : `Se suma desde el vencimiento actual (${fechaCorta(m.fecha_vencimiento)}); no pierde días.`}
              </p>
              <Button size="lg" disabled={!pagoOk || ocupado} onClick={() => setConfPago(true)}>
                {ocupado ? "Enviando…" : "Registrar pago"}
              </Button>
            </fieldset>
            )}

            <PlanNegocio key={JSON.stringify([d.modulos, d.zona_horaria, d.limite_tarjetas_activas, d.whatsapp?.portafolio_id])}
              d={d} admin={esAdmin} onCambio={() => { void cargar(d.negocio_id); onCambio(); }} />

            {mostrarPrueba && (
              <fieldset disabled={ocupado} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <h3 className="text-base font-semibold">Extender prueba</h3>
                <Label htmlFor="p-dias">Días extra</Label>
                <div className="flex flex-wrap gap-2">
                  {["7", "15", "30"].map((v) => (
                    <Rapido key={v} activo={dias === v} onClick={() => setDias(v)}>{v}</Rapido>
                  ))}
                  <Input id="p-dias" inputMode="numeric" className="h-11 w-20" value={dias}
                    onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Solo para negocios que todavía no han pagado. Los días se suman al vencimiento actual o, si ya venció, a partir de hoy.
                </p>
                <Button size="lg" variant="secondary" disabled={!diasOk || ocupado} onClick={() => setConfPrueba(true)}>
                  {ocupado ? "Enviando…" : "Extender prueba"}
                </Button>
              </fieldset>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">Últimos movimientos</h3>
              {d.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {d.movimientos.slice(0, 5).map((mv, i) => (
                    <li key={`${mv.creado_en}-${i}`} className="py-2">
                      <p className="break-words text-sm font-medium">{textoMovimiento(mv)}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        {fechaCorta(mv.fecha_vencimiento_anterior)} → {fechaCorta(mv.fecha_vencimiento_nueva)} · {nombreStaff(mv.staff)} · {instante(mv.creado_en)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <AlertDialog open={confPago} onOpenChange={(o) => !ocupado && setConfPago(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Registrar el pago?</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {d?.nombre_comercial}: {plural(nMeses, "mes", "meses")} por {pesos(centavos)}. Referencia: {ref}. El dueño recibirá un aviso por WhatsApp.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={ocupado} onClick={(e) => { e.preventDefault(); void registrar(); }}>
                Sí, registrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confPrueba} onOpenChange={(o) => !ocupado && setConfPrueba(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Extender la prueba {nDias} días a {d?.nombre_comercial}?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={ocupado} onClick={(e) => { e.preventDefault(); void extender(); }}>
                Sí, extender
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function Rapido({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("tap-target min-w-11 rounded-full px-4 text-sm font-semibold ring-1",
        activo ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border")}>
      {children}
    </button>
  );
}
