import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IconoTono } from "@/components/fila-lista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/client";
import { configuracionCumpleanos, guardarConfiguracionCumpleanos, VIGENCIAS, type VigenciaCumpleanos } from "@/lib/api/cumpleanos";
import { cn } from "@/lib/utils";

/**
 * Claude (2026-11-20, backend 0061): el dueño configura su beneficio de
 * cumpleaños. Con él activado, la Caja muestra el botón "Entregar beneficio
 * de cumpleaños" solo dentro de la vigencia y una vez por cliente al año.
 */
export function BeneficioCumpleanos() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["cumpleanos-config"], queryFn: configuracionCumpleanos });
  const [activo, setActivo] = useState(false);
  const [beneficio, setBeneficio] = useState("");
  const [vigencia, setVigencia] = useState<VigenciaCumpleanos>("semana");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.data) return;
    setActivo(config.data.activo); setBeneficio(config.data.beneficio ?? ""); setVigencia(config.data.vigencia);
  }, [config.data]);

  const valido = beneficio.trim().length >= 3 && beneficio.trim().length <= 80;
  const guardar = async () => {
    if (ocupado) return;
    if (!valido) return setError("Escribe el beneficio (de 3 a 80 caracteres).");
    setOcupado(true); setError(null);
    try {
      const r = await guardarConfiguracionCumpleanos({ activo, beneficio: beneficio.trim(), vigencia });
      queryClient.setQueryData(["cumpleanos-config"], r);
      toast.success(r.activo ? "Listo: la Caja ya ofrece el beneficio de cumpleaños" : "Guardado: el beneficio está desactivado");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar. Intenta de nuevo.");
    } finally { setOcupado(false); }
  };

  if (config.error) return null;
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <IconoTono icono={Cake} tono="primary" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Beneficio de cumpleaños</h2>
          <p className="text-sm text-muted-foreground">La Caja lo ofrece una vez al año a cada cliente, dentro de la vigencia.</p>
        </div>
      </div>
      {!config.data ? <p className="mt-4 text-sm text-muted-foreground">Cargando…</p> : <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl bg-secondary px-4 py-3">
          <span className="text-base font-medium">Ofrecer beneficio de cumpleaños</span>
          <Switch checked={activo} onCheckedChange={setActivo} disabled={ocupado} aria-label="Ofrecer beneficio de cumpleaños" />
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="beneficio-cumple">¿Qué le das?</Label>
          <Input id="beneficio-cumple" value={beneficio} maxLength={80} placeholder="Un café gratis" disabled={ocupado} onChange={(e) => setBeneficio(e.target.value)} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">¿Cuándo vale?</legend>
          {VIGENCIAS.map((v) => (
            <button key={v.valor} type="button" aria-pressed={vigencia === v.valor} disabled={ocupado} onClick={() => setVigencia(v.valor)}
              className={cn("min-h-14 rounded-xl px-4 py-3 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                vigencia === v.valor ? "bg-card ring-2 ring-primary" : "bg-card ring-border")}>
              <span className="block text-base font-semibold">{v.nombre}</span>
              <span className="block text-sm text-muted-foreground">{v.ayuda}</span>
            </button>
          ))}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="min-h-12" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar"}</Button>
      </form>}
    </section>
  );
}
