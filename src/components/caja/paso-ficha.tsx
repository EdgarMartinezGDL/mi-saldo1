import { FileWarning, Gift, PlusCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { guardarCorreoCliente, type ClienteCaja } from "@/lib/api/caja";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { fechaCorta, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";
import { Tecla, useConMouse, useFocoCaja, useTecla } from "./teclado";
import { avisarError, EncabezadoPaso, nombreCliente, useCaja } from "./caja-contexto";

export const puedeAcumular = (c: ClienteCaja) => !!c.monedero?.acumula || (c.tarjetas ?? []).some((t) => t.acumula);
export const puedeCanjear = (c: ClienteCaja) =>
  c.cliente.puede_canjear && ((c.monedero?.saldo_centavos ?? 0) > 0 || (c.tarjetas ?? []).some((t) => t.completas_por_canjear > 0));

function Accion({ icono, texto, ayuda, disabled, onClick, tecla }: { tecla: string; icono: ReactNode; texto: string; ayuda?: string | undefined; disabled?: boolean; onClick: () => void }) {
  const conMouse = useConMouse();
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn("btn-premium flex min-h-20 w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background")}>
      <span className="shrink-0">{icono}</span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold">{texto}</span>
        {ayuda && <span className="block text-sm opacity-80">{ayuda}</span>}
      </span>
      {conMouse && <span className="ml-auto shrink-0"><Tecla>{tecla}</Tecla></span>}
    </button>
  );
}

export const correoCajaValido = (correo: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

export function PasoFicha({ ficha, onAccion, onVolver, onRefrescar }: { ficha: ClienteCaja; onAccion: (a: "acumular" | "canjear" | "reclamar") => void; onVolver: () => void; onRefrescar: () => Promise<void> }) {
  const conMouse = useConMouse();
  useFocoCaja();
  const { moneda, ejecutar } = useCaja();
  const [editando, setEditando] = useState(false);
  const [correo, setCorreo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const refCorreo = useDesplazarAlAbrir<HTMLFormElement>(editando, conMouse);
  const c = ficha.cliente;
  const guardar = async () => {
    if (!correoCajaValido(correo) || ocupado || c.correo?.estado === "confirmado") return;
    setOcupado(true);
    const valor = correo.trim();
    try {
      const r = await ejecutar(() => guardarCorreoCliente(c.persona_id, valor));
      toast.success(r.guardado ? `Correo guardado. Le enviamos un aviso a ${r.correo.enmascarado}.` : "El cliente ya tenía ese correo.");
      setEditando(false); setCorreo("");
      await onRefrescar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) toast.error("Revisa el correo: está mal escrito.");
      else avisarError(e, moneda);
      if (e instanceof ApiError && e.status === 404) onVolver();
    } finally { setOcupado(false); }
  };
  useTecla((e) => {
    const k = e.key.toLowerCase();
    if (k === "a" && puedeAcumular(ficha)) { onAccion("acumular"); return true; }
    if (k === "c" && puedeCanjear(ficha)) { onAccion("canjear"); return true; }
    if (k === "r") { onAccion("reclamar"); return true; }
    return false;
  }, { activo: !ocupado });
  useTecla((e) => {
    if (e.key !== "Escape") return;
    if (editando) { setEditando(false); setCorreo(""); } else onVolver();
    return true;
    return false;
  }, { activo: !ocupado, inclusoEnCampos: true });
  const premios = (ficha.tarjetas ?? []).filter((t) => t.completas_por_canjear > 0);
  return (
    <div className="mx-auto flex w-full max-w-xl lg:max-w-none flex-col gap-5">
      <EncabezadoPaso titulo={nombreCliente(c)} subtitulo={c.cuenta_activada ? "Cliente con app activada" : "Aún no activa su app"} onVolver={onVolver} />

      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
      {c.correo && <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className={c.correo.estado === "sin_correo" ? "text-warn" : "text-muted-foreground"}>
            {c.correo.estado === "confirmado" ? "Correo confirmado" : c.correo.estado === "sin_confirmar" ? `Correo: ${c.correo.enmascarado} (sin confirmar)` : "Sin correo: no recibe avisos por correo"}
          </p>
          {c.correo.estado !== "confirmado" && !editando && <Button size="sm" variant="secondary" onClick={() => { setCorreo(""); setEditando(true); }}>
            {c.correo.estado === "sin_correo" ? "Agregar correo" : "Corregir correo"}
          </Button>}
        </div>
        {editando && c.correo.estado !== "confirmado" && <form ref={refCorreo} className="flex flex-col gap-3" noValidate onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <Label htmlFor="ficha-correo">Correo del cliente</Label>
          <Input id="ficha-correo" type="email" inputMode="email" autoComplete="off" value={correo} disabled={ocupado} onChange={(e) => setCorreo(e.target.value)} />
          <p className="text-sm text-muted-foreground">Le enviaremos un aviso a ese correo. Solo el cliente puede confirmarlo desde su app.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={ocupado} onClick={() => { setEditando(false); setCorreo(""); }}>Cancelar</Button>
            <Button type="submit" disabled={ocupado || !correoCajaValido(correo)}>Guardar correo</Button>
          </div>
        </form>}
      </div>}

      {ficha.monedero && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Saldo</p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums">{pesos(ficha.monedero.saldo_centavos, moneda)}</p>
          {ficha.monedero.fecha_vencimiento && <p className="mt-1 text-sm font-medium text-warn">Vence el {fechaCorta(ficha.monedero.fecha_vencimiento)}</p>}
        </div>
      )}

      {(ficha.tarjetas ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {(ficha.tarjetas ?? []).map((t) => (
            <li key={t.tarjeta_digital_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-lg font-semibold">{t.nombre}</p>
                <span className="shrink-0 rounded-full bg-secondary px-3 py-1 font-mono text-base font-bold">{t.sellos_actuales}/{t.sellos_requeridos}</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (t.sellos_actuales / Math.max(1, t.sellos_requeridos)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Premio: {t.premio_texto}{t.fecha_vencimiento ? ` · vence el ${fechaCorta(t.fecha_vencimiento)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {premios.length > 0 && (
        <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/40">
          <p className="flex items-center gap-2 text-base font-semibold"><Gift className="size-5" /> Premios listos</p>
          <ul className="mt-2 flex flex-col gap-1">
            {premios.map((t) => (
              <li key={t.tarjeta_digital_id} className="text-base">{t.completas_por_canjear} × {t.premio_por_canjear ?? t.premio_texto}</li>
            ))}
          </ul>
        </div>
      )}

      </div>
      <div className="flex h-fit min-w-0 flex-col gap-3 lg:sticky lg:top-24">
        <Accion tecla="A" icono={<PlusCircle className="size-8" />} texto="Acumular" disabled={!puedeAcumular(ficha)}
          ayuda={puedeAcumular(ficha) ? "Saldo o sellos por esta compra" : "Este cliente no puede acumular aquí"} onClick={() => onAccion("acumular")} />
        <Accion tecla="C" icono={<Gift className="size-8" />} texto="Canjear" disabled={!puedeCanjear(ficha)}
          ayuda={!c.puede_canjear ? "Debe activar su app para canjear" : puedeCanjear(ficha) ? "Usar saldo o entregar un premio" : "No tiene saldo ni premios"} onClick={() => onAccion("canjear")} />
        <Accion tecla="R" icono={<FileWarning className="size-8" />} texto="Reportar compra no registrada" ayuda="Si no se le sumó saldo o sellos" onClick={() => onAccion("reclamar")} />
      </div>
      </div>
    </div>
  );
}
