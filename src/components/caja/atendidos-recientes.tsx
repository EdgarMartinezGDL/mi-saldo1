import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { consultarHistorial } from "@/lib/api/operacion";
import { nombreCompleto } from "@/lib/api/formato";
import { useCaja } from "./caja-contexto";
import { miJornada } from "./caja-extra";

export interface Atendido { telefono: string; nombre: string; fecha: string }

/** U-03: last clients served today (acumulaciones y canjes), newest first, one row per phone. */
export function ultimosAtendidos(movs: Array<{ fecha: string; tipo: string; cliente?: { nombre: string; apellido_paterno?: string | null; telefono?: string | null } | null }>, max = 5): Atendido[] {
  const vistos = new Set<string>();
  const lista: Atendido[] = [];
  for (const m of movs) {
    const tel = m.cliente?.telefono;
    if (!tel?.startsWith("+52") || tel.length !== 13 || (m.tipo !== "acumulacion" && m.tipo !== "canje") || vistos.has(tel)) continue;
    vistos.add(tel);
    lista.push({ telefono: tel.slice(3), nombre: nombreCompleto({ nombre: m.cliente!.nombre, apellido_paterno: m.cliente!.apellido_paterno ?? null }), fecha: m.fecha });
    if (lista.length === max) break;
  }
  return lista;
}

/** Empleado: solo los suyos (mi-jornada). Dueño: los de todo el negocio hoy (historial). */
export function AtendidosRecientes({ onElegir, deshabilitado }: { onElegir: (digitos: string) => void; deshabilitado?: boolean }) {
  const { rol, zona } = useCaja();
  const { data } = useQuery({
    queryKey: ["caja-atendidos", rol],
    queryFn: async () => ultimosAtendidos(rol === "empleado" ? (await miJornada()).movimientos : (await consultarHistorial({ limite: 50 })).movimientos),
    staleTime: 0,
    retry: false,
  });
  if (!data?.length) return null;
  const hora = (f: string) => new Date(f).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: zona });
  return (
    <section aria-labelledby="atendidos-titulo" className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 id="atendidos-titulo" className="flex items-center gap-2 text-base font-semibold"><History className="size-5 text-muted-foreground" /> Atendidos hace poco</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {data.map((a) => (
          <li key={a.telefono}>
            <button
              type="button"
              disabled={deshabilitado}
              onClick={() => onElegir(a.telefono)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ring-1 ring-border transition hover:bg-muted disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.nombre}</span>
                {/* Solo los últimos 4 dígitos: la pantalla de la caja la puede ver quien esté enfrente. */}
                <span className="block text-sm text-muted-foreground">Termina en {a.telefono.slice(6)}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{hora(a.fecha)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
