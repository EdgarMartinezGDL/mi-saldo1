import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Alerta } from "./enlace-ui";
import type { DatosPago } from "@/lib/api/operacion";
import { crearPago, errorPago, estadosPago, pagosMembresia } from "@/lib/api/pagos";
import { instante, pesos } from "@/lib/api/formato";
import { plural } from "@/lib/plural";

export function PagoEnLinea({ pasarela }: { pasarela: DatosPago["pasarela"] }) {
  const [metodo, setMetodo] = useState<"tarjeta" | "oxxo">(pasarela.metodos[0] ?? "tarjeta");
  const [meses, setMeses] = useState(1);
  const [llave, setLlave] = useState(() => crypto.randomUUID());
  const enviando = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation({ mutationFn: crearPago, onSuccess: ({ pago }) => {
    if (pago.url_pago) window.location.assign(pago.url_pago);
    else { enviando.current = false; setError("No está disponible el enlace de pago. Intenta de nuevo."); }
  }, onError: (e) => { enviando.current = false; setError(errorPago(e)); } });
  return <form className="flex flex-col gap-3 p-2 pt-3" onSubmit={(e) => {
    e.preventDefault(); if (enviando.current || !pasarela.disponible) return;
    enviando.current = true; setError(null); crear.mutate({ metodo, meses, idempotency_key: llave });
  }}>
    {pasarela.simulado && <Alerta tono="aviso">Modo de prueba: ningún cobro es real.</Alerta>}
    <fieldset disabled={crear.isPending} className="flex flex-col gap-2"><legend className="mb-2 text-sm font-medium">Método</legend>
      {(["tarjeta", "oxxo"] as const).filter((m) => pasarela.metodos.includes(m)).map((m) => <label key={m} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3 text-sm"><input type="radio" name="metodo-pago" value={m} checked={metodo === m} onChange={() => { if (metodo !== m) { setMetodo(m); setLlave(crypto.randomUUID()); enviando.current = false; } }} />{m === "tarjeta" ? "Tarjeta de crédito o débito" : "Efectivo en OXXO"}</label>)}
    </fieldset>
    <Label htmlFor="pago-meses">Meses</Label><select id="pago-meses" disabled={crear.isPending} value={meses} className="h-12 rounded-xl border border-input bg-background px-3" onChange={(e) => { const n = Number(e.target.value); if (n !== meses) { setMeses(n); setLlave(crypto.randomUUID()); enviando.current = false; } }}>{Array.from({ length: pasarela.meses_maximos }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{plural(n, "mes", "meses")}</option>)}</select>
    <p className="text-lg font-semibold">Total: {pesos(pasarela.precio_mensual_centavos * meses, pasarela.moneda)} {pasarela.moneda}</p>
    {error && <Alerta>{error}</Alerta>}
    <Button type="submit" size="lg" disabled={crear.isPending || enviando.current}>{crear.isPending ? "Preparando tu pago…" : "Continuar al pago"}</Button>
    <p className="text-sm text-muted-foreground">La tarjeta se captura en la página segura de Mercado Pago. MiSaldo nunca ve los datos de tu tarjeta.</p>
  </form>;
}

export function HistorialPagosEnLinea() {
  const pagos = useQuery({ queryKey: ["pagos-membresia"], queryFn: pagosMembresia, gcTime: 0, retry: false });
  if (!pagos.data?.pagos?.length) return null;
  return <div className="mt-4"><h3 className="text-base font-semibold">Pagos en línea</h3><ul className="mt-2 divide-y divide-border">{pagos.data.pagos.map((p) => <li key={p.id}><Link to="/membresia/pago/$id" params={{ id: p.id }} className="flex flex-wrap items-center justify-between gap-2 py-3"><span><span className="block text-sm font-medium">{plural(p.meses, "mes", "meses")} · {pesos(p.monto_centavos, p.moneda)} {p.moneda} · {p.metodo === "tarjeta" ? "Tarjeta" : "OXXO"}</span><span className="text-xs text-muted-foreground">{instante(p.creado_en)}</span></span><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{estadosPago[p.estado]}</span></Link></li>)}</ul></div>;
}