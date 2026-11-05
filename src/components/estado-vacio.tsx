import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconoTono } from "@/components/fila-lista";

/** Empty state: tinted icon, short message and an optional action. */
export function EstadoVacio({ icono, titulo, texto, accion }: { icono: LucideIcon; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <IconoTono icono={icono} tono="neutro" className="size-14 rounded-2xl [&_svg]:size-7" />
      <p className="text-base font-semibold">{titulo}</p>
      {texto && <p className="max-w-xs text-sm text-muted-foreground">{texto}</p>}
      {accion}
    </div>
  );
}
