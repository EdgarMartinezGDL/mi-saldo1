import { cn } from "@/lib/utils";

/** Digit slots: empty wells, filled with a dot, and the next one highlighted while entry is active. */
export function CasillasDigitos({ largo, llenos, activo = true, grande = false, className, ariaLabel }: {
  largo: number; llenos: number; activo?: boolean; grande?: boolean; className?: string; ariaLabel?: string;
}) {
  return (
    <span className={cn("flex", grande ? "gap-2" : "gap-1.5", className)} aria-label={ariaLabel ?? `${llenos} de ${largo} dígitos`}>
      {Array.from({ length: largo }, (_, i) => (
        <span key={i} className={cn(
          "flex-1 grid place-items-center transition-colors border-2",
          grande ? "h-14 rounded-xl" : "h-11 rounded-lg",
          i < llenos || (activo && i === llenos && llenos < largo) ? "bg-card border-primary" : "bg-casilla border-casilla-borde",
          activo && i === llenos && llenos < largo && "ring-4 ring-primary/15",
        )}>
          {i < llenos && <span className="size-3.5 rounded-full bg-primary" />}
        </span>
      ))}
    </span>
  );
}