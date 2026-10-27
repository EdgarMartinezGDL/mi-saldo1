import type { ClienteCaja } from "@/lib/api/caja";
import { pesos } from "@/lib/api/formato";
import { nombreCliente, useCaja } from "./caja-contexto";

export function ResumenCliente({ ficha }: { ficha: ClienteCaja }) {
  const { moneda } = useCaja();
  return (
    <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
      <h2 className="text-2xl font-semibold">{nombreCliente(ficha.cliente)}</h2>
      {ficha.monedero && <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">Saldo</p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{pesos(ficha.monedero.saldo_centavos, moneda)}</p>
      </div>}
      {(ficha.tarjetas ?? []).map((t) => <div key={t.tarjeta_digital_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-lg font-semibold">{t.nombre}</p>
        <p className="mt-2 font-mono text-xl font-bold">{t.sellos_actuales}/{t.sellos_requeridos}</p>
        <p className="mt-2 text-sm text-muted-foreground">Premio: {t.premio_texto}</p>
        {t.completas_por_canjear > 0 && <p className="mt-2 text-base font-semibold">{t.completas_por_canjear} × {t.premio_por_canjear ?? t.premio_texto}</p>}
      </div>)}
    </aside>
  );
}