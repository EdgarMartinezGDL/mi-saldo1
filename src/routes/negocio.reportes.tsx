import { createFileRoute } from "@tanstack/react-router";
import { Cake, UserX, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ConConfig, SeccionNegocio } from "@/components/negocio/comun";
import { CampoTexto, errorOperacion } from "@/components/negocio/operacion-ui";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { guardarArchivo } from "@/lib/api/client";
import { contarReporte, descargarReporte, type Reporte } from "@/lib/api/marketing";

export const Route = createFileRoute("/negocio/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes · MiSaldo" },
      { name: "description", content: "Cumpleañeros e inactivos en Excel, con enlace de WhatsApp." },
      { property: "og:title", content: "Reportes · MiSaldo" },
      { property: "og:description", content: "Descarga cumpleañeros e inactivos con enlace de WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Reportes" descripcion="Cumpleañeros e inactivos en Excel, con enlace de WhatsApp.">
      <ConConfig>
        {(c) => (
          <>
            <TarjetaReporte tipo="cumpleaneros" negocio={c.negocio.nombre_comercial} />
            <TarjetaReporte tipo="inactivos" negocio={c.negocio.nombre_comercial} />
            <p className="text-sm text-muted-foreground">Solo aparecen los clientes que aceptan promociones y tienen teléfono.</p>
          </>
        )}
      </ConConfig>
    </SeccionNegocio>
  ),
});

/** "Today" in Mexico City as YYYY-MM-DD, independent of the device time zone. */
const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const isoUtc = (d: Date) => d.toISOString().slice(0, 10);
const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

const CONF: Record<Reporte, { titulo: string; icono: LucideIcon; rango: string; ayuda?: string; max: number; maxTexto: string; sugerido: (n: string) => string; rangoInicial: () => [string, string] }> = {
  cumpleaneros: {
    titulo: "Cumpleañeros",
    icono: Cake,
    rango: "Cumplen años entre…",
    max: 366,
    maxTexto: "El rango máximo es de 366 días.",
    sugerido: (n) => `en ${n} te deseamos un muy feliz cumpleaños. Ven a visitarnos este mes: tenemos una sorpresa para ti.`,
    rangoInicial: () => {
      const h = utc(hoyMx());
      return [isoUtc(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1))), isoUtc(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, 0)))];
    },
  },
  inactivos: {
    titulo: "Inactivos",
    icono: UserX,
    rango: "Su última compra fue entre…",
    ayuda: 'Clientes que compraron por última vez en esas fechas y no han vuelto. Incluye a los archivados (columna "Archivado" del Excel).',
    max: 3653,
    maxTexto: "El rango máximo es de 10 años.",
    sugerido: (n) => `en ${n} te extrañamos. Vuelve pronto: tenemos algo especial para ti.`,
    rangoInicial: () => {
      const h = utc(hoyMx());
      const haceUnAno = new Date(Date.UTC(h.getUTCFullYear() - 1, h.getUTCMonth(), h.getUTCDate()));
      return [isoUtc(haceUnAno), isoUtc(new Date(h.getTime() - 30 * 86400000))];
    },
  },
};

function TarjetaReporte({ tipo, negocio }: { tipo: Reporte; negocio: string }) {
  const c = CONF[tipo];
  const conTotp = useConTotp();
  const [[desde, hasta], setRango] = useState(c.rangoInicial);
  const [texto, setTexto] = useState("");
  const [incluir_archivados, setIncluirArchivados] = useState(false);
  const [conteo, setConteo] = useState<{ conteo: number; excede_limite: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const errorRango = !desde || !hasta ? "Elige las dos fechas." : dias(desde, hasta) < 0 ? "La fecha inicial debe ser antes de la final." : dias(desde, hasta) > c.max ? c.maxTexto : null;
  const MSG = { rango_invalido: "La fecha inicial debe ser antes de la final.", rango_excedido: c.maxTexto, excede_limite: "Son más de 20,000: reduce el rango" };

  const contar = async () => {
    setOcupado(true);
    try {
      setConteo(await contarReporte(tipo, { desde, hasta, ...(tipo === "cumpleaneros" ? { incluir_archivados } : {}) }));
    } catch (e) {
      errorOperacion(e, undefined, MSG);
    } finally {
      setOcupado(false);
    }
  };
  const descargar = async () => {
    setOcupado(true);
    try {
      const t = texto.trim();
      guardarArchivo(await conTotp(() => descargarReporte(tipo, { desde, hasta, ...(tipo === "cumpleaneros" ? { incluir_archivados } : {}), ...(t ? { texto: t } : {}) })));
    } catch (e) {
      errorOperacion(e, undefined, MSG);
    } finally {
      setOcupado(false);
    }
  };

  const fecha = "h-12 rounded-xl border border-border bg-card px-3 text-base shadow-soft";
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><c.icono className="size-5 text-primary" /> {c.titulo}</h2>
      <p className="mt-3 text-base font-medium">{c.rango}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="date" aria-label="Desde" max={tipo === "inactivos" ? hoyMx() : undefined} value={desde} onChange={(e) => { setRango([e.target.value, hasta]); setConteo(null); }} className={fecha} />
        <span className="text-muted-foreground">y</span>
        <input type="date" aria-label="Hasta" max={tipo === "inactivos" ? hoyMx() : undefined} value={hasta} onChange={(e) => { setRango([desde, e.target.value]); setConteo(null); }} className={fecha} />
      </div>
      {tipo === "cumpleaneros" && (
        <label className="mt-3 flex items-center gap-3 text-sm font-medium">
          <Checkbox checked={incluir_archivados} onCheckedChange={(v) => { setIncluirArchivados(v === true); setConteo(null); }} aria-label="Incluir archivados" />
          Incluir archivados
        </label>
      )}
      {c.ayuda && <p className="mt-3 text-sm text-muted-foreground">{c.ayuda}</p>}
      {errorRango && <p className="mt-2 text-sm text-destructive">{errorRango}</p>}
      <div className="mt-4">
        <CampoTexto etiqueta="Mensaje de WhatsApp (opcional)" ayuda="Cada mensaje empieza con 'Hola {nombre del cliente}, ' y sigue con tu texto" valor={texto} onChange={setTexto} max={500} />
        <p className="mt-1 text-xs text-muted-foreground">Sugerido: {c.sugerido(negocio)}</p>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="secondary" size="lg" className="tap-target h-12" disabled={!!errorRango || ocupado} onClick={() => void contar()}>Contar</Button>
        {conteo && conteo.conteo > 0 && !conteo.excede_limite && (
          <Button size="lg" className="tap-target h-12" disabled={ocupado} onClick={() => void descargar()}>Descargar Excel</Button>
        )}
      </div>
      {conteo && (
        <p className="mt-3 text-base font-medium">
          {conteo.excede_limite ? "Son más de 20,000: reduce el rango" : conteo.conteo === 0 ? "No hay clientes en ese rango" : `${conteo.conteo} ${conteo.conteo === 1 ? "cliente" : "clientes"}`}
        </p>
      )}
    </section>
  );
}
