import { Gift, Minus, Plus, PlusCircle, Stamp, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { CampoDigitos } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acumularMonedero, acumularSellos, canjearMonedero, canjearPremio, type ClienteCaja } from "@/lib/api/caja";
import { telefonoE164 } from "@/lib/api/client";
import { aCentavos, fechaCorta, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";
import { avisarError, Confirmar, EncabezadoPaso, nombreCliente, soloMonto, useCaja, useLlave } from "./caja-contexto";
import { Tecla } from "./teclado";
import { useTecladoOperacion } from "./teclado-operacion";
import { plural } from "@/lib/plural";

export interface Comprobante { titulo: string; lineas: string[] }

interface Opcion { id: string; titulo: string; detalle: string; icono: ReactNode }

function Opciones({ opciones, valor, onChange }: { opciones: Opcion[]; valor: string; onChange: (id: string) => void }) {
  if (opciones.length < 2) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {opciones.map((o) => (
        <button data-caja-opcion key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn("flex min-h-16 items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", valor === o.id ? "bg-primary/12 ring-2 ring-primary" : "bg-card ring-border")}>
          <span className="shrink-0 text-primary">{o.icono}</span>
          <span className="min-w-0"><span className="block text-lg font-semibold">{o.titulo}</span><span className="block truncate text-sm text-muted-foreground">{o.detalle}</span></span>
        </button>
      ))}
    </div>
  );
}

function CampoMonto({ id, etiqueta, valor, onChange, ayuda, extra, inputRef, conMouse }: { conMouse: boolean; inputRef?: RefObject<HTMLInputElement | null>; id: string; etiqueta: string; valor: string; onChange: (v: string) => void; ayuda?: string | undefined; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">{etiqueta}</Label>
      <div className="flex gap-2">
        <Input ref={inputRef} data-sin-centrar={conMouse ? "" : undefined} id={id} inputMode="decimal" placeholder="0.00" value={valor} onChange={(e) => onChange(soloMonto(e.target.value))} className="h-16 flex-1 font-mono text-3xl font-bold tabular-nums" />
        {extra}
      </div>
      {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

type Props = { telefono: string; ficha: ClienteCaja; onVolver: () => void; onHecho: (c: Comprobante) => void };

/** Acumular saldo (§7.1) or sellos (§7.2). */
export function PasoAcumular({ telefono, ficha, onVolver, onHecho }: Props) {
  const { config, moneda, ejecutar, recargarConfig } = useCaja();
  const llave = useLlave();
  const opciones = useMemo<Opcion[]>(() => [
    ...(ficha.monedero?.acumula ? [{ id: "monedero", titulo: "Saldo", detalle: `Cashback ${Math.round((config.monedero?.factor_cashback ?? 0) * 1000) / 10}%`, icono: <Wallet className="size-7" /> }] : []),
    ...(ficha.tarjetas ?? []).filter((t) => t.acumula).map((t) => ({ id: t.tarjeta_digital_id, titulo: t.nombre, detalle: `${t.sellos_actuales}/${t.sellos_requeridos} sellos`, icono: <Stamp className="size-7" /> })),
  ], [ficha, config]);
  const [destino, setDestino] = useState(opciones[0]?.id ?? "");
  const [monto, setMonto] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const tarjeta = ficha.tarjetas?.find((t) => t.tarjeta_digital_id === destino);
  const esMonedero = destino === "monedero";
  const porMonto = esMonedero || tarjeta?.tipo_sello === "por_monto";
  const centavos = aCentavos(monto);
  const pideCodigo = ficha.cliente.requiere_codigo_acumulacion;
  const listo = !!destino && (porMonto ? centavos > 0 : cantidad >= 1) && (!pideCodigo || codigo.length === 4);
  const estimado = Math.floor(centavos * (config.monedero?.factor_cashback ?? 0));

  const teclado = useTecladoOperacion({ listo, ocupado, soloCodigo: !!destino && (porMonto ? centavos > 0 : cantidad >= 1) && pideCodigo && codigo.length !== 4,
    onConfirmar: () => setConfirmar(true), onVolver, destino,
    ...(!pideCodigo ? { onOpcion: (i: number) => { const o = opciones[i]; if (o) setDestino(o.id); } } : {}),
    ...(!porMonto ? { onCantidad: (delta: number) => setCantidad((c) => Math.min(100, Math.max(1, c + delta))) } : {}),
  });
  const pregunta = esMonedero
    ? `¿Acumular por una compra de ${pesos(centavos, moneda)}?`
    : porMonto ? `¿Dar sellos por una compra de ${pesos(centavos, moneda)}?` : `¿Dar ${cantidad} ${cantidad === 1 ? "sello" : "sellos"}?`;

  const enviar = async () => {
    setOcupado(true);
    const tel = telefonoE164(telefono);
    const cod = pideCodigo ? { codigo_acumulacion: codigo } : {};
    try {
      if (esMonedero) {
        const datos = { telefono: tel, monto_compra_centavos: centavos, ...cod };
        const body = { ...datos, idempotency_key: llave.para(["saldo", datos]) };
        const r = await ejecutar(() => acumularMonedero(body));
        llave.terminar();
        onHecho({
          titulo: `Ganó ${pesos(r.monto_centavos, moneda)}`,
          lineas: [`Saldo: ${pesos(r.saldo_centavos, moneda)}`, ...(r.fecha_vencimiento ? [`Vence el ${fechaCorta(r.fecha_vencimiento)}`] : []), ...(r.cliente_sin_app_activada ? ["El cliente aún no activa su app."] : [])],
        });
      } else if (tarjeta) {
        const datos = { telefono: tel, tarjeta_digital_id: tarjeta.tarjeta_digital_id, ...cod, ...(porMonto ? { monto_compra_centavos: centavos } : { cantidad }) };
        const body = { ...datos, idempotency_key: llave.para(["sellos", datos]) };
        const r = await ejecutar(() => acumularSellos(body));
        llave.terminar();
        const premio = r.tarjetas_completadas[0]?.premio_texto;
        onHecho({
          titulo: premio ? `¡Completó su tarjeta! Ganó: ${premio}` : `+${r.sellos_agregados} ${r.sellos_agregados === 1 ? "sello" : "sellos"}`,
          lineas: [`${tarjeta.nombre}: ${r.tarjeta.sellos_actuales}/${r.tarjeta.sellos_requeridos}`, ...(r.cliente_sin_app_activada ? ["El cliente aún no activa su app."] : [])],
        });
      }
      setConfirmar(false);
    } catch (e) {
      setConfirmar(false);
      if (e instanceof Error && "codigo" in e && e.codigo === "modulo_en_retiro") recargarConfig();
      avisarError(e, moneda);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl lg:max-w-none flex-col gap-5">
      <EncabezadoPaso titulo="Acumular" subtitulo={nombreCliente(ficha.cliente)} onVolver={onVolver} />
      <Opciones opciones={opciones} valor={destino} onChange={setDestino} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); teclado.enviar(); }} onKeyDown={teclado.alTeclaFormulario} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        {porMonto ? (
          <CampoMonto conMouse={teclado.conMouse} inputRef={teclado.montoRef} id="acu-monto" etiqueta="Total de la compra" valor={monto} onChange={setMonto}
            ayuda={esMonedero && centavos > 0 ? `Ganará aprox. ${pesos(estimado, moneda)}` : tarjeta?.tipo_sello === "por_monto" ? "Los sellos se calculan según el monto." : undefined} />
        ) : (
          <div>
            <p className="mb-2 text-base font-medium">Sellos a dar</p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="lg" className="size-16" aria-label="Un sello menos" onClick={() => setCantidad((c) => Math.max(1, c - 1))}><Minus className="size-6" /></Button>
              <span className="flex-1 text-center font-mono text-4xl font-bold tabular-nums">{cantidad}</span>
              <Button type="button" variant="outline" size="lg" className="size-16" aria-label="Un sello más" onClick={() => setCantidad((c) => Math.min(100, c + 1))}><Plus className="size-6" /></Button>
            </div>
          </div>
        )}
        {pideCodigo && (
          <CampoDigitos botonRef={teclado.codigoRef} tecladoFisico={!ocupado} compacto={teclado.conMouse} etiqueta="Código de acumulación del cliente" ayuda="4 dígitos, lo ve en su app" valor={codigo} onChange={(v) => { if (!ocupado) setCodigo(v); }} largo={4} activo onActivar={() => undefined} />
        )}
        <Button type="submit" size="lg" className="h-16 w-full text-xl" disabled={!listo || ocupado}>
          <PlusCircle className="size-6" /> Acumular<Tecla>Enter</Tecla>
        </Button>
      </form>
      <Confirmar abierto={confirmar} titulo={pregunta} detalle={`Cliente: ${nombreCliente(ficha.cliente)}`} accion="Sí, acumular" ocupado={ocupado}
        onConfirmar={() => void enviar()} onCancelar={() => setConfirmar(false)} />
    </div>
  );
}

/** Canjear saldo (§7.3) or a premio (§7.4). */
export function PasoCanjear({ telefono, ficha, onVolver, onHecho }: Props) {
  const { moneda, ejecutar } = useCaja();
  const llave = useLlave();
  const saldo = ficha.monedero?.saldo_centavos ?? 0;
  const opciones = useMemo<Opcion[]>(() => [
    ...(saldo > 0 ? [{ id: "monedero", titulo: "Saldo", detalle: `Disponible ${pesos(saldo, moneda)}`, icono: <Wallet className="size-7" /> }] : []),
    ...(ficha.tarjetas ?? []).filter((t) => t.completas_por_canjear > 0).map((t) => ({ id: t.tarjeta_digital_id, titulo: t.premio_por_canjear ?? t.premio_texto, detalle: `${t.nombre} · ${plural(t.completas_por_canjear, "listo", "listos")}`, icono: <Gift className="size-7" /> })),
  ], [ficha, saldo, moneda]);
  const [destino, setDestino] = useState(opciones[0]?.id ?? "");
  const [monto, setMonto] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const esMonedero = destino === "monedero";
  const tarjeta = ficha.tarjetas?.find((t) => t.tarjeta_digital_id === destino);
  const centavos = aCentavos(monto);
  const listo = !!destino && codigo.length === 4 && (!esMonedero || (centavos > 0 && centavos <= saldo));
  const teclado = useTecladoOperacion({ listo, ocupado,
    soloCodigo: !!destino && (!esMonedero || (centavos > 0 && centavos <= saldo)) && codigo.length !== 4,
    onConfirmar: () => setConfirmar(true), onVolver, destino,
  });
  const premio = tarjeta?.premio_por_canjear ?? tarjeta?.premio_texto ?? "";

  const enviar = async () => {
    setOcupado(true);
    const tel = telefonoE164(telefono);
    try {
      if (esMonedero) {
        const datos = { telefono: tel, codigo_canje: codigo, monto_centavos: centavos };
        const body = { ...datos, idempotency_key: llave.para(["canje", datos]) };
        const r = await ejecutar(() => canjearMonedero(body));
        llave.terminar();
        onHecho({ titulo: `Canjeó ${pesos(r.monto_canjeado_centavos, moneda)}`, lineas: [`Saldo restante: ${pesos(r.saldo_centavos, moneda)}`, "Descuenta ese monto del cobro."] });
      } else if (tarjeta) {
        const datos = { telefono: tel, codigo_canje: codigo, tarjeta_digital_id: tarjeta.tarjeta_digital_id };
        const body = { ...datos, idempotency_key: llave.para(["premio", datos]) };
        const r = await ejecutar(() => canjearPremio(body));
        llave.terminar();
        onHecho({ titulo: `Entregar: ${r.premio_texto}`, lineas: [`Premios restantes de esta tarjeta: ${r.tarjetas_completas_restantes}`] });
      }
      setConfirmar(false);
    } catch (e) {
      setConfirmar(false);
      setCodigo("");
      const x = (e as { codigo?: string; extras?: Record<string, unknown> });
      if (x.codigo === "saldo_insuficiente" && typeof x.extras?.["saldo_centavos"] === "number") setMonto(((x.extras["saldo_centavos"] as number) / 100).toFixed(2));
      avisarError(e, moneda);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl lg:max-w-none flex-col gap-5">
      <EncabezadoPaso titulo="Canjear" subtitulo={nombreCliente(ficha.cliente)} onVolver={onVolver} />
      <Opciones opciones={opciones} valor={destino} onChange={setDestino} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); teclado.enviar(); }} onKeyDown={teclado.alTeclaFormulario} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        {esMonedero ? (
          <CampoMonto conMouse={teclado.conMouse} inputRef={teclado.montoRef} id="canje-monto" etiqueta="Saldo a usar" valor={monto} onChange={setMonto}
            ayuda={centavos > saldo ? `Solo tiene ${pesos(saldo, moneda)}.` : `Disponible: ${pesos(saldo, moneda)}`}
            extra={<Button type="button" variant="outline" size="lg" className="h-16" onClick={() => setMonto((saldo / 100).toFixed(2))}>Todo</Button>} />
        ) : tarjeta ? (
          <p className="text-lg">Premio: <span className="font-semibold">{premio}</span></p>
        ) : null}
        <CampoDigitos botonRef={teclado.codigoRef} tecladoFisico={!ocupado} compacto={teclado.conMouse} etiqueta="Código de canje del cliente" ayuda="4 dígitos, lo ve en su app" valor={codigo} onChange={(v) => { if (!ocupado) setCodigo(v); }} largo={4} activo onActivar={() => undefined} />
        <Button type="submit" size="lg" className="h-16 w-full text-xl" disabled={!listo || ocupado}>
          <Gift className="size-6" /> Canjear<Tecla>Enter</Tecla>
        </Button>
      </form>
      <Confirmar abierto={confirmar} titulo={esMonedero ? `¿Canjear ${pesos(centavos, moneda)}?` : `¿Entregar ${premio}?`}
        detalle={`Cliente: ${nombreCliente(ficha.cliente)}`} accion="Sí, canjear" ocupado={ocupado}
        onConfirmar={() => void enviar()} onCancelar={() => setConfirmar(false)} />
    </div>
  );
}
