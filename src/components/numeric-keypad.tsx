import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "limpiar"];

export function NumericKeypad({
  onKey,
  className,
  compacto = false,
}: {
  onKey: (key: string) => void;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {KEYS.map((key) => {
        const isAction = key === "borrar" || key === "limpiar";
        return (
          <button
            key={key}
            type="button"
            onClick={() => onKey(key)}
            aria-label={key === "borrar" ? "Borrar un dígito" : key === "limpiar" ? "Limpiar" : key}
            className={cn(
              "grid place-items-center rounded-2xl font-semibold border border-tecla-borde border-b-4 border-b-tecla-canto shadow-raised active:translate-y-[3px] active:border-b active:shadow-pressed transition-[transform,box-shadow,border-width] duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              compacto ? "h-12" : "h-16 sm:h-20",
              isAction
                 ? cn("bg-tecla-accion text-tecla-accion-foreground text-base", !compacto && "sm:text-lg")
                 : cn("bg-tecla text-tecla-foreground tabular-nums", compacto ? "text-xl" : "text-2xl sm:text-3xl"),
            )}
          >
            {key === "borrar" ? <Delete className="size-7" /> : key === "limpiar" ? "Limpiar" : key}
          </button>
        );
      })}
    </div>
  );
}
