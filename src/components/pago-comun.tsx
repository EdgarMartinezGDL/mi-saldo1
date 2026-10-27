import { Alerta } from "./enlace-ui";
import type { PagoMembresia } from "@/lib/api/pagos";
import { fechaAviso } from "@/lib/api/privacidad";

export function FichaOxxo({ ficha }: { ficha: PagoMembresia["datos_pago"]["oxxo"] }) {
  if (!ficha) return null;
  return <div className="flex flex-col gap-3">
    {ficha.referencia && <p className="break-words font-mono text-2xl font-bold">{ficha.referencia}</p>}
    {ficha.vence && <p className="text-sm">Vence: {fechaAviso(ficha.vence)}</p>}
    {ficha.instrucciones && <p className="text-sm text-muted-foreground">{ficha.instrucciones}</p>}
    {ficha.url_ficha && <a href={ficha.url_ficha} target="_blank" rel="noopener" className="text-primary underline">Ver ficha</a>}
  </div>;
}
export const AvisoPagoPrueba = () => <Alerta tono="aviso">Modo de prueba: ningún cobro es real.</Alerta>;