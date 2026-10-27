import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useDigitos } from "@/components/caja/teclado";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { avisoQuery } from "@/lib/api/privacidad";
import { useId } from "react";

/**
 * Reads `#t=<token>` once on mount and removes it from the address bar.
 * Returns undefined while reading, null when absent.
 */
export function useTokenFragmento() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("t");
    history.replaceState(null, "", window.location.pathname);
    setToken(t && /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : null);
  }, []);
  return token;
}

export function TarjetaEnlace({ titulo, subtitulo, icono, children }: { titulo: string; subtitulo?: string; icono: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-card p-6 shadow-soft ring-1 ring-border">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">{icono}</div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{subtitulo ?? "MiSaldo · By MicroFix Cloud"}</p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export const Alerta = ({ children, tono = "error" }: { children: ReactNode; tono?: "error" | "aviso" | "ok" }) => (
  <p role="alert" className={cn(
    "mb-4 rounded-xl p-3 text-sm font-medium",
    tono === "error" && "bg-destructive/10 text-destructive",
    tono === "aviso" && "bg-accent/15 text-foreground",
    tono === "ok" && "bg-primary/12 text-foreground",
  )}>{children}</p>
);

export function EnlaceNoValido({ mensaje = "Este enlace no es válido." }: { mensaje?: string | undefined }) {
  return (
    <>
      <Alerta>{mensaje}</Alerta>
      <Button asChild size="lg" className="w-full"><Link to="/login">Ir a Entrar</Link></Button>
    </>
  );
}

/** Digit entry with the existing big numeric keypad. */
export function CampoDigitos({ etiqueta, ayuda, valor, onChange, largo, limite = largo, activo, onActivar, tecladoFisico = false, compacto = false, botonRef }: {
  etiqueta: string; ayuda?: string; valor: string; onChange: (v: string) => void; largo: number; limite?: number; activo: boolean; onActivar: () => void;
  tecladoFisico?: boolean; compacto?: boolean; botonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const interno = useRef<HTMLButtonElement>(null);
  const ref = botonRef ?? interno;
  const onKey = (k: string) => {
    if (k === "borrar") onChange(valor.slice(0, -1));
    else if (k === "limpiar") onChange("");
    else if (valor.length < limite) onChange(valor + k);
  };
  useDigitos(onKey, { activo: tecladoFisico && activo, ref });
  return (
    <div className="flex flex-col gap-2">
      <button ref={ref} type="button" onClick={onActivar}
        className={cn("rounded-xl p-3 text-left ring-1 transition-colors", activo ? "ring-2 ring-primary" : "ring-border")}>
        <span className="block text-sm font-medium">{etiqueta}</span>
        {ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}
        <span className="mt-2 flex gap-1.5" aria-label={`${valor.length} de ${limite} dígitos`}>
          {Array.from({ length: largo }, (_, i) => (
            <span key={i} className="grid h-11 flex-1 place-items-center rounded-lg bg-secondary font-mono text-xl font-bold">
              {valor[i] ? "•" : ""}
            </span>
          ))}
        </span>
        {limite > largo && valor.length > largo && (
          <span className="mt-2 block text-sm text-muted-foreground">{valor.length} dígitos</span>
        )}
      </button>
      {activo && (
        <NumericKeypad compacto={compacto} onKey={onKey} />
      )}
    </div>
  );
}

export function AvisoPrivacidad({ valor, onChange, onVersion }: { valor: boolean; onChange: (v: boolean) => void; onVersion?: (version: string | null) => void }) {
  const aviso = useQuery(avisoQuery());
  const id = useId();
  const disponible = !!aviso.data && !aviso.isError && !aviso.isFetching;
  const version = disponible ? aviso.data?.version ?? null : null;
  const mostrada = useRef<string | null>(null);
  useEffect(() => {
    if (!version) return;
    if (mostrada.current && mostrada.current !== version) onChange(false);
    mostrada.current = version;
  }, [version, onChange]);
  useEffect(() => { onVersion?.(version); }, [version, onVersion]);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
        {aviso.isError ? <><p>No pudimos cargar el aviso de privacidad.</p><Button variant="link" className="h-auto p-0" onClick={() => void aviso.refetch()}>Reintentar</Button></> : !disponible ? <p>Cargando aviso…</p> : <><p>{aviso.data?.resumen}</p><Link to="/aviso-privacidad" target="_blank" rel="noopener" className="mt-2 inline-block text-primary underline">Leer el aviso completo</Link></>}
      </div>
      <div className="flex items-start gap-3 rounded-xl p-2">
        <Checkbox id={id} disabled={!disponible} checked={valor && disponible} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5 size-6" />
        <Label htmlFor={id} className="text-base leading-snug">Acepto el aviso de privacidad</Label>
      </div>
    </div>
  );
}

export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });
