import { FileWarning } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClienteCaja } from "@/lib/api/caja";
import { telefonoE164 } from "@/lib/api/client";
import { aCentavos, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { documentarReclamacion } from "./caja-extra";
import { avisarError, Confirmar, EncabezadoPaso, nombreCliente, soloMonto, useCaja, useLlave } from "./caja-contexto";
import { Tecla } from "./teclado";
import { useTecladoOperacion } from "./teclado-operacion";
import type { Comprobante } from "./paso-operacion";

const isoDia = (d: Date, zona: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);

/** "Reportar compra no registrada" (§8.1). */
export function PasoReclamar({ telefono, ficha, onVolver, onHecho }: { telefono: string; ficha: ClienteCaja; onVolver: () => void; onHecho: (c: Comprobante) => void }) {
  const { config, moneda, zona, ejecutar } = useCaja();
  const llave = useLlave();
  const destinos = [
    ...(config.modulos.includes("monedero") ? [{ id: "monedero", nombre: "Saldo" }] : []),
    ...(ficha.tarjetas ?? []).filter((t) => t.activa).map((t) => ({ id: t.tarjeta_digital_id, nombre: t.nombre })),
  ];
  const hoy = isoDia(new Date(), zona);
  const minimo = isoDia(new Date(Date.now() - 30 * 86400000), zona);
  const [destino, setDestino] = useState(destinos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [descripcion, setDescripcion] = useState("");
  const [ticket, setTicket] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const refForm = useDesplazarAlAbrir<HTMLFormElement>(true, false);

  const esMonedero = destino === "monedero";
  const valor = esMonedero ? aCentavos(cantidad) : Number(cantidad) || 0;
  const listo = !!destino && valor > 0 && (esMonedero || valor <= 1000) && fecha >= minimo && fecha <= hoy && descripcion.trim().length >= 10;
  const teclado = useTecladoOperacion({ listo, ocupado, onConfirmar: () => setConfirmar(true), onVolver,
    onOpcion: (i) => { const d = destinos[i]; if (d) { setDestino(d.id); setCantidad(""); } },
  });
  const textoCantidad = esMonedero ? pesos(valor, moneda) : `${valor} ${valor === 1 ? "sello" : "sellos"}`;

  const enviar = async () => {
    setOcupado(true);
    try {
      const datos = {
        telefono: telefonoE164(telefono),
        modulo: esMonedero ? ("monedero" as const) : ("tarjetas_sellos" as const),
        ...(esMonedero ? {} : { tarjeta_digital_id: destino }),
        cantidad_reclamada: valor,
        fecha_compra: fecha,
        descripcion: descripcion.trim(),
        ...(ticket.trim() ? { referencia_ticket: ticket.trim() } : {}),
      };
      const body = { ...datos, idempotency_key: llave.para(["reclamacion", datos]) };
      const r = await ejecutar(() => documentarReclamacion(body));
      llave.terminar();
      setConfirmar(false);
      onHecho({ titulo: `Reclamación ${r.reclamacion.folio} registrada`, lineas: ["El negocio la revisará y te avisará por WhatsApp."] });
    } catch (e) {
      setConfirmar(false);
      avisarError(e, moneda);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl lg:max-w-none flex-col gap-5">
      <EncabezadoPaso titulo="Compra no registrada" subtitulo={nombreCliente(ficha.cliente)} onVolver={onVolver} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); teclado.enviar(); }} onKeyDown={teclado.alTeclaFormulario} ref={refForm} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        <div>
          <p className="mb-2 text-base font-medium">¿Qué no se registró?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {destinos.map((d) => (
              <button data-caja-opcion key={d.id} type="button" onClick={() => { setDestino(d.id); setCantidad(""); }}
                className={cn("min-h-14 rounded-xl px-4 text-left text-base font-semibold ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", destino === d.id ? "bg-primary/12 ring-2 ring-primary" : "ring-border")}>
                {d.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rec-cant" className="text-base">{esMonedero ? "Saldo que faltó" : "Sellos que faltaron"}</Label>
          <Input ref={teclado.montoRef} data-sin-centrar={teclado.conMouse ? "" : undefined} id="rec-cant" inputMode={esMonedero ? "decimal" : "numeric"} placeholder={esMonedero ? "0.00" : "1"} value={cantidad}
            onChange={(e) => setCantidad(esMonedero ? soloMonto(e.target.value) : e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-14 font-mono text-2xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rec-fecha" className="text-base">Fecha de la compra</Label>
          <Input id="rec-fecha" type="date" min={minimo} max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-14 text-base" />
          <p className="text-sm text-muted-foreground">Solo compras de los últimos 30 días.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rec-desc" className="text-base">¿Qué pasó?</Label>
          <Textarea id="rec-desc" maxLength={1000} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="text-base" placeholder="Compró 2 cafés y no se le pusieron los sellos" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rec-ticket" className="text-base">Número de ticket (opcional)</Label>
          <Input id="rec-ticket" maxLength={60} value={ticket} onChange={(e) => setTicket(e.target.value)} className="h-14 text-base" />
        </div>
        <Button type="submit" size="lg" className="h-16 w-full text-xl" disabled={!listo || ocupado}>
          <FileWarning className="size-6" /> Reportar<Tecla>Enter</Tecla>
        </Button>
      </form>
      <Confirmar abierto={confirmar} titulo={`¿Reportar ${textoCantidad} sin registrar?`} detalle="El dueño revisará la reclamación." accion="Sí, reportar"
        ocupado={ocupado} onConfirmar={() => void enviar()} onCancelar={() => setConfirmar(false)} />
    </div>
  );
}
