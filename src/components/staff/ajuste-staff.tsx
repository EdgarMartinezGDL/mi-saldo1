import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CampoTexto, Confirmar } from "@/components/negocio/operacion-ui";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError, nuevaLlave } from "@/lib/api/client";
import { aCentavos, fechaCorta, instante, nombreCompleto, pesos } from "@/lib/api/formato";
import { ajusteStaffMonedero, ajusteStaffSellos, clienteStaff, type ClienteStaff, type ResultadoAjusteStaff } from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { errorStaff } from "./comun";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

const MSG: Record<string, string> = {
  conflicto_de_interes: "Eres dueño o empleado de ese negocio: que lo haga otro miembro de Staff",
  autoajuste: "No puedes ajustar tu propia cuenta.",
  modulo_inactivo: "Ese módulo no está activo en el negocio.",
  no_encontrado: "Ese negocio ya no existe.",
  cliente_no_encontrado: "Esta persona ya no es cliente de ese negocio.",
  tarjeta_no_encontrada: "Esa tarjeta ya no existe.",
  sin_configuracion: "El negocio no tiene configurado ese módulo.",
  idempotency_conflicto: "Ese ajuste ya se hizo con otros datos. Revisa los ajustes recientes.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
  monto_invalido: "Revisa el monto.",
  cantidad_invalida: "Los sellos deben ser de 1 a 1000.",
  referencia_invalida: "La referencia debe tener hasta 150 caracteres.",
};

type Objetivo = { id: "saldo" } | { id: string; nombre: string };

/** Staff manual adjustment for one client in one business (no membership/daily-cap checks; owner is always notified). */
export function AjusteStaff({ negocioId, personaId, onCerrar }: { negocioId: string | null; personaId: string; onCerrar: () => void }) {
  const movil = useIsMobile();
  const conTotp = useConTotp();
  const [datos, setDatos] = useState<ClienteStaff | null>(null);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const [signo, setSigno] = useState<1 | -1 | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ref, setRef] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAjusteStaff | null>(null);
  const llave = useRef<{ firma: string; llave: string } | null>(null);
  const refContenido = useDesplazarAlAbrir<HTMLDivElement>(negocioId);

  const cargar = async (id: string) => {
    try { setDatos(await clienteStaff(id, personaId)); } catch (e) { errorStaff(e, MSG); onCerrar(); }
  };
  useEffect(() => {
    setDatos(null); setObjetivo(null); setSigno(null); setCantidad(""); setMotivo(""); setRef(""); setResultado(null); llave.current = null;
    if (negocioId) void cargar(negocioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, personaId]);

  // One option per card; when a card is repeated (complete + open), use the open one.
  const tarjetas = new Map<string, string>();
  for (const t of datos?.tarjetas ?? []) if (!tarjetas.has(t.tarjeta_digital_id) || t.estado === "abierta") tarjetas.set(t.tarjeta_digital_id, t.tarjeta);
  const opciones: Objetivo[] = [
    ...(datos?.monedero ? [{ id: "saldo" } as const] : []),
    ...[...tarjetas].map(([id, nombre]) => ({ id, nombre })),
  ];

  const esSaldo = objetivo?.id === "saldo";
  const nombreObj = objetivo && "nombre" in objetivo ? objetivo.nombre : "";
  const valor = esSaldo ? aCentavos(cantidad) : Number.parseInt(cantidad, 10) || 0;
  const valorOk = esSaldo ? valor > 0 : valor >= 1 && valor <= 1000;
  const m = motivo.trim();
  const r = ref.trim();
  const listo = !!objetivo && !!signo && valorOk && m.length >= 5 && m.length <= 500 && r.length <= 150;
  const cliente = datos ? nombreCompleto(datos.cliente) : "";
  const sellos = (n: number) => `${n} ${Math.abs(n) === 1 ? "sello" : "sellos"}`;
  const titulo = !listo ? "" : esSaldo
    ? `¿${signo === 1 ? "Sumar" : "Restar"} ${pesos(valor)} ${signo === 1 ? "al" : "del"} saldo de ${cliente}?`
    : `¿${signo === 1 ? "Sumar" : "Restar"} ${sellos(valor)} ${signo === 1 ? "a" : "de"} ${nombreObj} de ${cliente}?`;

  const ejecutar = async () => {
    if (!listo || !objetivo || !signo || !negocioId || !datos) return;
    const firma = JSON.stringify([negocioId, objetivo.id, signo * valor, m, r]);
    if (llave.current?.firma !== firma) llave.current = { firma, llave: nuevaLlave() };
    const idempotency_key = llave.current.llave;
    const base = { persona_id: personaId, motivo: m, referencia_soporte: r || null, idempotency_key };
    try {
      const res = await conTotp(() =>
        esSaldo
          ? ajusteStaffMonedero(negocioId, { ...base, monto_centavos: signo * valor })
          : ajusteStaffSellos(negocioId, { ...base, tarjeta_digital_id: objetivo.id, cantidad: signo * valor }),
      );
      llave.current = null;
      setResultado(res);
      setConfirmar(false);
      void cargar(negocioId);
    } catch (e) {
      setConfirmar(false);
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.codigo !== "totp_cancelado" && e.codigo !== "requiere_totp_reciente") llave.current = null;
      errorStaff(e, MSG);
    }
  };

  const aplicado = (x: { aplicado: number; modulo?: string }, saldo: boolean) =>
    saldo ? `${x.aplicado > 0 ? "+" : ""}${pesos(x.aplicado)}` : `${x.aplicado > 0 ? "+" : ""}${sellos(x.aplicado)}`;

  return (
    <Sheet open={!!negocioId} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side={movil ? "bottom" : "right"} className={movil ? "max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-24" : "w-full overflow-y-auto sm:max-w-lg"}>
        <SheetHeader className="text-left">
          <SheetTitle>Ajustar saldo o sellos</SheetTitle>
          <SheetDescription>{datos ? `${cliente} en ${datos.negocio.nombre_comercial}. El dueño siempre recibe un aviso.` : "Cargando…"}</SheetDescription>
        </SheetHeader>
        {!datos ? <Cargando /> : (
          <div ref={refContenido} className="mt-4 flex flex-col gap-5">
            <section className="flex flex-col gap-1 text-sm">
              {datos.monedero && <p>Saldo: <span className="font-mono font-semibold">{pesos(datos.monedero.saldo_centavos)}</span>{datos.monedero.fecha_vencimiento && ` · vence el ${fechaCorta(datos.monedero.fecha_vencimiento)}`}</p>}
              {datos.tarjetas.map((t) => (
                <p key={t.cliente_tarjeta_id}>{t.tarjeta}: <span className="font-mono">{t.sellos_actuales}/{t.sellos_requeridos}</span>{t.estado === "completa" && " · premio listo"}</p>
              ))}
            </section>

            {resultado ? (
              <div className="flex flex-col gap-2 rounded-xl bg-secondary p-4">
                <p className="text-xl font-semibold">Listo: {aplicado(resultado, esSaldo)}</p>
                {resultado.duplicado && <p className="text-sm text-muted-foreground">Este ajuste ya estaba aplicado.</p>}
                {esSaldo && resultado.saldo_centavos !== undefined && <p>Saldo nuevo: {pesos(resultado.saldo_centavos)}</p>}
                {!esSaldo && resultado.tarjeta && <p>{resultado.tarjeta_nombre ?? nombreObj}: {resultado.tarjeta.sellos_actuales}/{resultado.tarjeta.sellos_requeridos}</p>}
                {resultado.topado && resultado.aviso && <p className="text-sm text-warn">{resultado.aviso}</p>}
                {resultado.referencia_soporte && <p className="text-sm text-muted-foreground">Referencia: {resultado.referencia_soporte}</p>}
                <Button onClick={() => { setResultado(null); setSigno(null); setCantidad(""); setMotivo(""); setRef(""); }}>Hacer otro ajuste</Button>
              </div>
            ) : opciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente no tiene saldo ni tarjetas para ajustar.</p>
            ) : (
              <div className="flex flex-col gap-4">
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
                    <Button size="lg" variant={signo === 1 ? "default" : "secondary"} onClick={() => setSigno(1)}><Plus className="size-5" /> Sumar</Button>
                    <Button size="lg" variant={signo === -1 ? "default" : "secondary"} onClick={() => setSigno(-1)}><Minus className="size-5" /> Restar</Button>
                  </div>
                  <Input inputMode={esSaldo ? "decimal" : "numeric"} placeholder={esSaldo ? "Cantidad en pesos" : "Sellos (1 a 1000)"} className="h-12 text-base" disabled={!objetivo}
                    value={cantidad} onChange={(e) => setCantidad(esSaldo ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
                <CampoTexto etiqueta="3. Motivo" ayuda="El cliente y el dueño lo leen" valor={motivo} onChange={setMotivo} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="aj-ref">Referencia de soporte (opcional)</Label>
                  <Input id="aj-ref" maxLength={150} placeholder="WA-000123" className="h-11" value={ref} onChange={(e) => setRef(e.target.value)} />
                </div>
                <Button size="lg" disabled={!listo} onClick={() => setConfirmar(true)}>Continuar</Button>
              </div>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">Ajustes recientes</h3>
              {datos.ajustes_recientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin ajustes.</p> : (
                <ul className="flex flex-col divide-y divide-border">
                  {datos.ajustes_recientes.slice(0, 20).map((a) => (
                    <li key={a.ajuste_id} className="py-2 text-sm">
                      <p className="font-medium">
                        {a.origen === "staff" ? "Staff" : "Dueño"} · {aplicado(a, a.modulo === "monedero")}{a.tarjeta ? ` en ${a.tarjeta}` : ""}
                      </p>
                      <p className="break-words text-muted-foreground">{a.motivo}</p>
                      <p className="text-xs text-muted-foreground">{a.referencia_soporte ? `${a.referencia_soporte} · ` : ""}{instante(a.creado_en)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        <Confirmar abierto={confirmar} onAbierto={setConfirmar} titulo={titulo} descripcion="El dueño recibe un aviso." boton="Sí, ajustar" accion={ejecutar} />
      </SheetContent>
    </Sheet>
  );
}
