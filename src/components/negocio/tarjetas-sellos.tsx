import { useInvalidarAsistente } from "@/components/negocio/asistente";
import { Plus, Stamp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfigNegocio } from "@/components/negocio/comun";
import { Chip, Confirmar, errorOperacion } from "@/components/negocio/operacion-ui";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ConfiguracionNegocio, TarjetaConfig } from "@/lib/api/caja";
import { aCentavos, pesos } from "@/lib/api/formato";
import { activarTarjeta, crearTarjeta, editarTarjeta } from "@/lib/api/marketing";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { cn } from "@/lib/utils";

const MENSAJES = {
  nombre_duplicado: "Ya tienes una tarjeta activa con ese nombre",
  modulo_en_retiro: "Las tarjetas están en retiro: no se pueden crear ni activar",
  tarjeta_no_encontrada: "No encontramos esa tarjeta.",
};
const error = (e: unknown, limite: number) =>
  errorOperacion(e, undefined, {
    ...MENSAJES,
    limite_tarjetas: `Llegaste al límite de ${limite} tarjetas activas de tu plan: desactiva una o pide más a soporte de MiSaldo`,
  });

const regla = (t: TarjetaConfig) =>
  t.tipo_sello === "por_monto" ? `1 sello cada ${pesos(t.valor_por_sello_centavos ?? 0)}` : "1 sello por visita";
const vigencia = (d: number | null) => {
  if (!d) return "No vence";
  const m = Math.round(d / 30);
  return `Vence a los ${m} ${m === 1 ? "mes" : "meses"}`;
};

export function TarjetasSellos({ cfg }: { cfg: ConfiguracionNegocio }) {
  const invalidarAsistente = useInvalidarAsistente();
  const { actualizar } = useConfigNegocio();
  const conTotp = useConTotp();
  const [editando, setEditando] = useState<TarjetaConfig | "nueva" | null>(null);
  const [desactivar, setDesactivar] = useState<TarjetaConfig | null>(null);
  const [activando, setActivando] = useState<TarjetaConfig | null>(null);
  const tarjetas = cfg.tarjetas ?? [];
  const limite = cfg.negocio.limite_tarjetas_activas;
  const activas = tarjetas.filter((t) => t.activa).length;
  const enLimite = activas >= limite;
  const enRetiro = cfg.modulos_en_retiro.includes("tarjetas_sellos");

  const reemplazar = (t: TarjetaConfig) =>
    actualizar((c) => {
      const lista = c.tarjetas ?? [];
      const nueva = lista.some((x) => x.tarjeta_digital_id === t.tarjeta_digital_id)
        ? lista.map((x) => (x.tarjeta_digital_id === t.tarjeta_digital_id ? t : x))
        : [...lista, t];
      return { ...c, tarjetas: [...nueva].sort((a, b) => Number(b.activa) - Number(a.activa)) };
    });

  const cambiarActiva = async (t: TarjetaConfig, activa: boolean) => {
    try {
      const r = await conTotp(() => activarTarjeta(t.tarjeta_digital_id, activa));
      reemplazar({ ...t, ...r, activa });
      invalidarAsistente();
      toast.success(activa ? "Tarjeta activada" : "Tarjeta desactivada");
      setDesactivar(null);
      setActivando(null);
    } catch (e) {
      setDesactivar(null);
      setActivando(null);
      error(e, limite);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Stamp className="size-5 text-primary" /> Tarjetas de sellos</h2>
      {!cfg.modulos.includes("tarjetas_sellos") ? (
        <p className="mt-1 text-sm text-muted-foreground">Tu negocio no tiene activadas las tarjetas de sellos.</p>
      ) : (
        <>
          {enRetiro && <p className="mt-1 text-sm text-muted-foreground">Ya no se dan sellos nuevos; los clientes aún pueden canjear los que tienen.</p>}
          <p className="mt-2 text-base font-medium">Activas: {activas} de {limite}</p>
          {!enRetiro && (
            <div className="mt-3">
              <Button size="lg" className="tap-target h-12 w-full sm:w-auto" disabled={enLimite} onClick={() => setEditando("nueva")}>
                <Plus className="size-5" /> Nueva tarjeta
              </Button>
              {enLimite && <p className="mt-2 text-sm text-amber-400">Llegaste al límite de tu plan: desactiva una o pide más a soporte de MiSaldo</p>}
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {tarjetas.map((t) => (
              <li key={t.tarjeta_digital_id} className={cn("rounded-xl p-4 ring-1 ring-border", !t.activa && "opacity-75")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-base font-semibold">{t.nombre}</p>
                  <Chip tono={t.activa ? "verde" : "gris"}>{t.activa ? "Activa" : "Desactivada"}</Chip>
                </div>
                <p className="mt-1 text-sm">{regla(t)}</p>
                <p className="text-sm">{t.sellos_requeridos} sellos → {t.premio_texto}</p>
                <p className="text-sm text-muted-foreground">{vigencia(t.vigencia_dias)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" className="tap-target" onClick={() => setEditando(t)}>Editar</Button>
                  {t.activa ? (
                    <Button variant="outline" className="tap-target" onClick={() => setDesactivar(t)}>Desactivar</Button>
                  ) : (
                    !enRetiro && <Button variant="outline" className="tap-target" onClick={() => setActivando(t)}>Activar</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Confirmar
        abierto={!!desactivar}
        onAbierto={(o) => !o && setDesactivar(null)}
        titulo={`¿Desactivar ${desactivar?.nombre ?? "la tarjeta"}?`}
        descripcion="La caja ya no dará sellos en esta tarjeta. Tus clientes conservan y pueden canjear sus premios."
        boton="Sí, desactivar"
        accion={() => cambiarActiva(desactivar!, false)}
      />
      <Confirmar
        abierto={!!activando}
        onAbierto={(o) => !o && setActivando(null)}
        titulo={`¿Activar ${activando?.nombre ?? "la tarjeta"}?`}
        descripcion="La caja volverá a dar sellos en esta tarjeta."
        boton="Sí, activar"
        accion={() => cambiarActiva(activando!, true)}
      />
      <FormularioTarjeta
        tarjeta={editando}
        onCerrar={() => setEditando(null)}
        onGuardada={(t) => { reemplazar(t); invalidarAsistente(); setEditando(null); }}
        limite={limite}
      />
    </section>
  );
}

function FormularioTarjeta({ tarjeta, onCerrar, onGuardada, limite }: { tarjeta: TarjetaConfig | "nueva" | null; onCerrar: () => void; onGuardada: (t: TarjetaConfig) => void; limite: number }) {
  const movil = useIsMobile();
  const abierta = tarjeta !== null;
  const t = tarjeta === "nueva" ? null : tarjeta;
  return (
    <Sheet open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side={movil ? "bottom" : "right"} className="max-h-[92vh] overflow-y-auto pb-10 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t ? `Editar ${t.nombre}` : "Nueva tarjeta"}</SheetTitle>
        </SheetHeader>
        {abierta && <Campos key={t?.tarjeta_digital_id ?? "nueva"} t={t} onGuardada={onGuardada} limite={limite} />}
      </SheetContent>
    </Sheet>
  );
}

function Campos({ t, onGuardada, limite }: { t: TarjetaConfig | null; onGuardada: (t: TarjetaConfig) => void; limite: number }) {
  const conTotp = useConTotp();
  const [nombre, setNombre] = useState(t?.nombre ?? "");
  const [premio, setPremio] = useState(t?.premio_texto ?? "");
  const [sellos, setSellos] = useState(t ? String(t.sellos_requeridos) : "");
  const [meses, setMeses] = useState(t?.vigencia_dias ? String(Math.round(t.vigencia_dias / 30)) : "");
  const [tipo, setTipo] = useState<TarjetaConfig["tipo_sello"]>(t?.tipo_sello ?? "por_transaccion");
  const [monto, setMonto] = useState(t?.valor_por_sello_centavos ? (t.valor_por_sello_centavos / 100).toFixed(2) : "");
  const [confirmar, setConfirmar] = useState(false);
  const refCampos = useDesplazarAlAbrir(true, true);

  const n = nombre.trim();
  const p = premio.trim();
  const s = Number(sellos);
  const m = meses ? Number(meses) : null;
  const centavos = aCentavos(monto);
  const errores = [
    (n.length < 1 || n.length > 100) && "El nombre debe tener de 1 a 100 caracteres.",
    (p.length < 1 || p.length > 200) && "El premio debe tener de 1 a 200 caracteres.",
    (!Number.isInteger(s) || s < 1 || s > 100) && "Los sellos para el premio van de 1 a 100.",
    m !== null && (!Number.isInteger(m) || m < 1 || m > 120) && "La vigencia va de 1 a 120 meses (vacío = no vence).",
    tipo === "por_monto" && centavos <= 0 && "Escribe cada cuánto dinero se da un sello (mayor que $0).",
  ].filter(Boolean) as string[];

  const guardar = async () => {
    const cuerpo = {
      nombre: n,
      sellos_requeridos: s,
      valor_por_sello_centavos: tipo === "por_monto" ? centavos : null,
      premio_texto: p,
      vigencia_dias: m === null ? null : m * 30,
    };
    try {
      const r = await conTotp(() => (t ? editarTarjeta(t.tarjeta_digital_id, cuerpo) : crearTarjeta({ ...cuerpo, tipo_sello: tipo })));
      toast.success(t ? "Tarjeta guardada" : "Tarjeta creada");
      setConfirmar(false);
      onGuardada(r);
    } catch (e) {
      setConfirmar(false);
      error(e, limite);
    }
  };

  const campo = "h-12 text-base";
  return (
    <div ref={refCampos} className="mt-4 flex flex-col gap-4 px-1">
      {t && (
        <p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-400 ring-1 ring-amber-400/30">
          Los cambios aplican a las tarjetas nuevas: las que tus clientes ya tienen abiertas conservan su meta y su premio.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="t-nombre" className="text-base">Nombre</Label>
        <Input id="t-nombre" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cortes" className={campo} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="t-premio" className="text-base">Premio</Label>
        <Input id="t-premio" maxLength={200} value={premio} onChange={(e) => setPremio(e.target.value)} placeholder="1 corte gratis" className={campo} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-sellos" className="text-base">Sellos para el premio</Label>
          <Input id="t-sellos" inputMode="numeric" value={sellos} onChange={(e) => setSellos(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="5" className={campo} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="t-meses" className="text-base">Vigencia en meses</Label>
          <Input id="t-meses" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Vacío = no vence" className={campo} />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Tipo de sello{t && " (no se puede cambiar)"}</legend>
        {([["por_transaccion", "Uno por visita"], ["por_monto", "Uno por cada $…"]] as const).map(([v, txt]) => (
          <button
            key={v}
            type="button"
            disabled={!!t}
            aria-pressed={tipo === v}
            onClick={() => setTipo(v)}
            className={cn(
              "tap-target rounded-xl px-4 py-3 text-left text-base ring-1 disabled:cursor-not-allowed",
              tipo === v ? "bg-primary/15 font-semibold text-primary ring-primary/50" : "ring-border",
              t && tipo !== v && "opacity-50",
            )}
          >
            {txt}
          </button>
        ))}
        {tipo === "por_monto" && (
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="t-monto" className="text-base">Un sello por cada (pesos)</Label>
            <Input id="t-monto" inputMode="decimal" disabled={!!t} value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))} placeholder="100" className={campo} />
          </div>
        )}
      </fieldset>
      {errores.length > 0 && (nombre || premio || sellos) && <p className="text-sm text-destructive">{errores[0]}</p>}
      <Button size="lg" className="tap-target h-14 text-base" disabled={errores.length > 0} onClick={() => setConfirmar(true)}>
        {t ? "Guardar cambios" : "Crear tarjeta"}
      </Button>
      <Confirmar
        abierto={confirmar}
        onAbierto={setConfirmar}
        titulo={t ? "¿Guardar los cambios?" : "¿Crear la tarjeta?"}
        descripcion={`${n}: ${s} sellos → ${p}. ${tipo === "por_monto" ? `1 sello cada ${pesos(centavos)}` : "1 sello por visita"}. ${vigencia(m === null ? null : m * 30)}.`}
        boton={t ? "Sí, guardar" : "Sí, crear"}
        accion={guardar}
      />
    </div>
  );
}
