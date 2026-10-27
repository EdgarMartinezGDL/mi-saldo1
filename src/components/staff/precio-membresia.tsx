import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alerta } from "@/components/enlace-ui";
import { Cargando } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { aCentavos, pesos } from "@/lib/api/formato";
import { fijarPrecioMembresia, precioMembresia, type PrecioMembresia } from "@/lib/api/staff";
import { useNivelStaff } from "./comun";

const fechaPrecio = (iso: string) => new Intl.DateTimeFormat("es-MX", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City",
}).format(new Date(iso));

function DatosPrecio({ precio }: { precio: PrecioMembresia }) {
  return <>
    <p className="text-sm text-muted-foreground">Desde el {fechaPrecio(precio.desde)} · por {precio.staff.nombre} · confirmado con {precio.factor === "totp" ? "autenticador" : "PIN"}</p>
    <p className="break-words text-sm">“{precio.motivo}”</p>
  </>;
}

export function TarjetaPrecioMembresia() {
  const { esAdmin } = useNivelStaff();
  const precio = useQuery({ queryKey: ["precio-membresia"], queryFn: precioMembresia, retry: false });
  const [historial, setHistorial] = useState(false);
  const [abierto, setAbierto] = useState(false);
  return <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
    <div><h2 className="text-lg font-semibold">Precio de la membresía</h2>
      <p className="text-sm text-muted-foreground">Es el precio del pago en línea (Mercado Pago). Los pagos manuales no cambian.</p></div>
    {precio.isPending ? <Cargando /> : precio.isError ? <><Alerta>{precio.error instanceof ApiError ? precio.error.message : "No se pudo cargar el precio."}</Alerta><Button variant="secondary" onClick={() => void precio.refetch()}>Reintentar</Button></> : precio.data && <>
      {precio.data.vigente ? <><p className="text-2xl font-semibold">{pesos(precio.data.vigente.precio_mensual_centavos)} MXN al mes</p><DatosPrecio precio={precio.data.vigente} /></> : <Alerta tono="aviso">Sin precio: los dueños no pueden pagar en línea hasta que un administrador lo fije.</Alerta>}
      <div className="flex flex-wrap gap-2">
        {precio.data.historial.length > 0 && <Button variant="link" aria-expanded={historial} onClick={() => setHistorial(!historial)}>Ver historial</Button>}
        {esAdmin && <Button onClick={() => setAbierto(true)}>{precio.data.vigente ? "Cambiar precio" : "Fijar precio"}</Button>}
      </div>
      {historial && precio.data.historial.length > 0 && <ul className="divide-y divide-border">{precio.data.historial.map((p, i) => <li key={`${p.desde}-${i}`} className="flex flex-col gap-1 py-3"><p className="font-semibold">{pesos(p.precio_mensual_centavos)} MXN al mes</p><DatosPrecio precio={p} /></li>)}</ul>}
      {abierto && esAdmin && <DialogoPrecio vigente={precio.data.vigente} onCerrar={() => setAbierto(false)} />}
    </>}
  </section>;
}

function DialogoPrecio({ vigente, onCerrar }: { vigente: PrecioMembresia | null; onCerrar: () => void }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(vigente ? (vigente.precio_mensual_centavos / 100).toFixed(2) : "");
  const [motivo, setMotivo] = useState("");
  const [factor, setFactor] = useState<"totp" | "pin">("totp");
  const [secreto, setSecreto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const bloqueo = useRef(false);
  const leerPrecio = (texto: string) => {
    let limpio = texto.replace(/\$|MXN|\s/gi, "");
    if (/^\d+,\d{1,2}$/.test(limpio)) limpio = limpio.replace(",", ".");
    else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(limpio)) limpio = limpio.replace(/,/g, "");
    const centavos = aCentavos(limpio);
    return { centavos, valido: /^\d+(?:\.\d{1,2})?$/.test(limpio) && centavos >= 1000 && centavos <= 10000000 };
  };
  const { centavos, valido: precioValido } = leerPrecio(valor);
  const cambiarPrecio = (e: { currentTarget: HTMLInputElement }) => setValor(e.currentTarget.value);
  const cambiarMotivo = (e: { currentTarget: HTMLTextAreaElement }) => setMotivo(e.currentTarget.value);
  const cambiarSecreto = (e: { currentTarget: HTMLInputElement }) => setSecreto(factor === "totp" ? e.currentTarget.value.replace(/\D/g, "").slice(0, 6) : e.currentTarget.value);
  const cerrar = () => { if (!bloqueo.current) { setSecreto(""); onCerrar(); } };
  const guardar = async (datos: FormData, formulario: HTMLFormElement) => {
    if (bloqueo.current) return;
    const valor = String(datos.get("precio") ?? "");
    const motivo = String(datos.get("motivo") ?? "");
    const secreto = String(datos.get("secreto") ?? "");
    setValor(valor); setMotivo(motivo); setSecreto(secreto); setError(null);
    const { centavos, valido } = leerPrecio(valor);
    const m = motivo.trim();
    const fallo = !valido ? { campo: "precio", mensaje: "Escribe el precio en pesos, de $10.00 a $100,000.00 (ej. 299.99)." }
      : m.length < 5 || m.length > 200 ? { campo: "motivo", mensaje: "Escribe el motivo (mínimo 5 caracteres)." }
      : factor === "totp" && !/^\d{6}$/.test(secreto) ? { campo: "secreto", mensaje: "Escribe los 6 dígitos de tu app autenticadora." }
      : factor === "pin" && (secreto.length < 4 || secreto.length > 128) ? { campo: "secreto", mensaje: "Escribe tu PIN." } : null;
    if (fallo) {
      setError(fallo.mensaje);
      const campo = formulario.elements.namedItem(fallo.campo);
      if (campo instanceof HTMLElement) campo.focus();
      return;
    }
    bloqueo.current = true; setEnviando(true); setError(null);
    try {
      const r = await fijarPrecioMembresia({ precio_mensual_centavos: centavos, motivo: m, ...(factor === "totp" ? { codigo_totp: secreto } : { pin: secreto }) });
      setSecreto("");
      qc.setQueryData(["precio-membresia"], (prev: { vigente: PrecioMembresia | null; historial: PrecioMembresia[] } | undefined) => ({ vigente: r.vigente, historial: r.cambiado ? [r.vigente, ...(prev?.historial ?? [])].slice(0, 20) : prev?.historial ?? [r.vigente] }));
      void qc.invalidateQueries({ queryKey: ["precio-membresia"] });
      toast.success(r.cambiado ? `Precio actualizado: ${pesos(r.vigente.precio_mensual_centavos)} MXN al mes.` : "Ese ya era el precio vigente.");
      onCerrar();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const crudo = err?.extras["message"];
      const mensaje = typeof crudo === "string" ? crudo : Array.isArray(crudo) && typeof crudo[0] === "string" ? crudo[0] : err?.message ?? "Algo salió mal. Intenta de nuevo.";
      if (err?.status === 422) {
        setSecreto("");
        const intentos = err.extras["intentos_restantes"];
        setError(`${mensaje}${typeof intentos === "number" ? ` Te quedan ${intentos} intentos` : ""}`);
      } else if (err?.status === 429) setError(err.retryAfter ? `Demasiados intentos. Espera ${Math.ceil(err.retryAfter / 60)} minutos.` : err.message);
      else if (err?.status === 403 && err.codigo === "sin_permiso") setError("Solo un administrador puede cambiar el precio.");
      else if (err?.status === 401) { setSecreto(""); onCerrar(); }
      else setError(mensaje);
    } finally { bloqueo.current = false; setEnviando(false); }
  };
  return <Dialog open onOpenChange={(o) => { if (!o) cerrar(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{vigente ? "Cambiar precio" : "Fijar precio"}</DialogTitle><DialogDescription>Confirma que eres tú</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void guardar(new FormData(e.currentTarget), e.currentTarget); }}>
        <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5"><Label htmlFor="precio-mensual">Precio mensual (MXN)</Label><Input id="precio-mensual" name="precio" autoComplete="off" inputMode="decimal" placeholder="349.00" value={valor} onChange={cambiarPrecio} onInput={cambiarPrecio} />
            <p className="text-sm text-muted-foreground">{precioValido ? `Los dueños pagarán ${pesos(centavos)} MXN al mes` : "De $10.00 a $100,000.00."}</p></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="precio-motivo">Motivo del cambio</Label><Textarea id="precio-motivo" name="motivo" autoComplete="off" value={motivo} maxLength={200} placeholder="Precio de lanzamiento" onChange={cambiarMotivo} onInput={cambiarMotivo} /><p className="text-xs text-muted-foreground">{motivo.length}/200 caracteres</p></div>
          <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-sm font-medium">Confirma que eres tú</legend>
            {([ ["totp", "Código del autenticador"], ["pin", "Mi PIN"] ] as const).map(([f, texto]) => <label key={f} className="flex items-center gap-2 text-sm"><input type="radio" name="precio-factor" value={f} checked={factor === f} onChange={() => { setFactor(f); setSecreto(""); setError(null); }} />{texto}</label>)}
            <Input key={factor} name="secreto" aria-label={factor === "totp" ? "Código del autenticador" : "Mi PIN"} type={factor === "pin" ? "password" : "text"} inputMode="numeric" autoComplete={factor === "totp" ? "one-time-code" : "off"} data-1p-ignore={factor === "pin" ? "true" : undefined} data-lpignore={factor === "pin" ? "true" : undefined} maxLength={factor === "totp" ? 6 : 128} value={secreto} onChange={cambiarSecreto} onInput={cambiarSecreto} />
          </fieldset>
        </fieldset>
        {precioValido && centavos !== vigente?.precio_mensual_centavos && <p className="text-sm">El precio cambia de {vigente ? `${pesos(vigente.precio_mensual_centavos)} MXN` : "sin precio"} a {pesos(centavos)} MXN. Las órdenes que ya existen conservan su monto.</p>}
        {error && <Alerta>{error}</Alerta>}
        <DialogFooter><Button type="button" variant="outline" disabled={enviando} onClick={cerrar}>Cancelar</Button><Button type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar precio"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}