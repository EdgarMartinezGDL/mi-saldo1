import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CampoTexto, Confirmar, errorOperacion } from "@/components/negocio/operacion-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConTotp } from "@/components/totp-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError, nuevaLlave } from "@/lib/api/client";
import type { FichaCliente } from "@/lib/api/dueno";
import { aCentavos, fechaCorta, nombreCompleto, pesos } from "@/lib/api/formato";
import { ajusteMonedero, ajusteSellos, type ResultadoAjuste } from "@/lib/api/operacion";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

type Objetivo = { id: "saldo" } | { id: string; nombre: string };

/** Manual adjustment sheet: what → add/subtract + amount → reason → confirm → receipt. */
export function AjusteManual({ ficha, telefono, abierto, onAbierto, onHecho }: {
  ficha: FichaCliente;
  telefono: string;
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  onHecho: () => void;
}) {
  const movil = useIsMobile();
  const conTotp = useConTotp();
  const opciones: Objetivo[] = [
    ...(ficha.monedero ? [{ id: "saldo" } as const] : []),
    ...(ficha.tarjetas ?? []).filter((t) => t.activa).map((t) => ({ id: t.tarjeta_digital_id, nombre: t.nombre })),
  ];
  const [objetivo, setObjetivo] = useState<Objetivo | null>(opciones.length === 1 ? opciones[0]! : null);
  const [signo, setSigno] = useState<1 | -1 | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAjuste | null>(null);
  const refResultado = useDesplazarAlAbrir(resultado);
  // One key per operation; reused on retries of the same data.
  const llave = useRef<{ firma: string; llave: string } | null>(null);

  const esSaldo = objetivo?.id === "saldo";
  const nombreObj = objetivo && "nombre" in objetivo ? objetivo.nombre : "";
  const valor = esSaldo ? aCentavos(cantidad) : Number.parseInt(cantidad, 10) || 0;
  const valorOk = esSaldo ? valor > 0 : valor >= 1 && valor <= 1000;
  const motivoOk = motivo.trim().length >= 5 && motivo.trim().length <= 500;
  const listo = !!objetivo && !!signo && valorOk && motivoOk;
  const cliente = nombreCompleto(ficha.cliente);
  const sellosTxt = (n: number) => `${n} ${n === 1 ? "sello" : "sellos"}`;

  const titulo = !listo
    ? ""
    : esSaldo
      ? `¿${signo === 1 ? "Sumar" : "Restar"} ${pesos(valor)} ${signo === 1 ? "al" : "del"} saldo de ${cliente}?`
      : `¿${signo === 1 ? "Sumar" : "Restar"} ${sellosTxt(valor)} ${signo === 1 ? "a" : "de"} ${nombreObj} de ${cliente}?`;

  const reiniciar = () => {
    setObjetivo(opciones.length === 1 ? opciones[0]! : null);
    setSigno(null);
    setCantidad("");
    setMotivo("");
    setResultado(null);
    llave.current = null;
  };

  const ejecutar = async () => {
    if (!listo || !objetivo || !signo) return;
    const m = motivo.trim();
    const firma = JSON.stringify([objetivo.id, signo * valor, m, telefono]);
    if (llave.current?.firma !== firma) llave.current = { firma, llave: nuevaLlave() };
    const idempotency_key = llave.current.llave;
    try {
      const r = await conTotp(() =>
        esSaldo
          ? ajusteMonedero({ telefono, monto_centavos: signo * valor, motivo: m, idempotency_key })
          : ajusteSellos({ telefono, tarjeta_digital_id: objetivo.id, cantidad: signo * valor, motivo: m, idempotency_key }),
      );
      llave.current = null;
      setResultado(r);
      setConfirmar(false);
      onHecho();
    } catch (e) {
      setConfirmar(false);
      // Definitive rejections get a fresh key next time; network/TOTP failures keep it.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.codigo !== "totp_cancelado") llave.current = null;
      errorOperacion(e, esSaldo ? "monedero" : "tarjetas_sellos");
    }
  };

  const aplicadoTxt = (r: ResultadoAjuste) => (esSaldo ? pesos(r.aplicado) : `${r.aplicado > 0 ? "+" : ""}${r.aplicado} ${Math.abs(r.aplicado) === 1 ? "sello" : "sellos"}`);

  return (
    <Sheet open={abierto} onOpenChange={(o) => { if (!o) reiniciar(); onAbierto(o); }}>
      <SheetContent side={movil ? "bottom" : "right"} className="max-h-[92vh] overflow-y-auto pb-10 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Ajustar saldo o sellos</SheetTitle>
        </SheetHeader>
        {resultado ? (
          <div ref={refResultado} className="mt-4 flex flex-col gap-3 px-1">
            <p className="text-2xl font-semibold">Listo: {aplicadoTxt(resultado)}</p>
            {resultado.duplicado && <p className="text-sm text-muted-foreground">Este ajuste ya estaba aplicado.</p>}
            {esSaldo && resultado.saldo_centavos !== undefined && <p>Saldo nuevo: {pesos(resultado.saldo_centavos)}</p>}
            {!esSaldo && resultado.tarjeta && (
              <p>
                {resultado.tarjeta_nombre ?? nombreObj}: {resultado.tarjeta.sellos_actuales}/{resultado.tarjeta.sellos_requeridos}
                {resultado.tarjeta.fecha_vencimiento && ` · vence el ${fechaCorta(resultado.tarjeta.fecha_vencimiento)}`}
              </p>
            )}
            {resultado.topado && resultado.aviso && <p className="rounded-xl bg-amber-400/15 p-3 text-sm text-amber-400">{resultado.aviso}</p>}
            {(resultado.tarjetas_completadas ?? 0) > 0 && <p>Completó {plural(resultado.tarjetas_completadas ?? 0, "tarjeta", "tarjetas")}</p>}
            {(resultado.tarjetas_reabiertas ?? 0) > 0 && <p>{(resultado.tarjetas_reabiertas ?? 0) === 1 ? "Se reabrió" : "Se reabrieron"} {plural(resultado.tarjetas_reabiertas ?? 0, "tarjeta", "tarjetas")}</p>}
            <Button size="lg" onClick={() => { reiniciar(); onAbierto(false); }}>Cerrar</Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-5 px-1">
            {opciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente no tiene saldo ni tarjetas activas para ajustar.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">1. Qué ajustar</span>
                  <div className="flex flex-wrap gap-2">
                    {opciones.map((o) => (
                      <button key={o.id} type="button" onClick={() => { setObjetivo(o); setCantidad(""); }}
                        className={cn("tap-target rounded-full px-4 py-2 text-sm font-semibold ring-1", objetivo?.id === o.id ? "bg-primary text-primary-foreground ring-primary" : "bg-muted ring-border")}>
                        {"nombre" in o ? o.nombre : "Saldo"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">2. Sumar o restar</span>
                  <div className="grid grid-cols-2 gap-3">
                    <Button size="lg" variant={signo === 1 ? "default" : "secondary"} className="h-14 text-lg" onClick={() => setSigno(1)}><Plus className="size-5" /> Sumar</Button>
                    <Button size="lg" variant={signo === -1 ? "default" : "secondary"} className="h-14 text-lg" onClick={() => setSigno(-1)}><Minus className="size-5" /> Restar</Button>
                  </div>
                  <Input
                    inputMode={esSaldo ? "decimal" : "numeric"}
                    placeholder={esSaldo ? "Cantidad en pesos" : "Sellos (1 a 1000)"}
                    className="h-12 text-base"
                    disabled={!objetivo}
                    value={cantidad}
                    onChange={(e) => setCantidad(esSaldo ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <CampoTexto etiqueta="3. Motivo" ayuda="El cliente lo recibe por WhatsApp" valor={motivo} onChange={setMotivo} />
                <Button size="lg" disabled={!listo} onClick={() => setConfirmar(true)}>Continuar</Button>
              </>
            )}
          </div>
        )}
        <Confirmar abierto={confirmar} onAbierto={setConfirmar} titulo={titulo} boton="Sí, ajustar" accion={ejecutar} />
      </SheetContent>
    </Sheet>
  );
}
