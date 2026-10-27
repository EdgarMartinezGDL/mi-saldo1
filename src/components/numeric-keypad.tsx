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
              "grid place-items-center rounded-2xl font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              compacto ? "h-12 text-xl" : "h-16 text-2xl sm:h-20 sm:text-3xl",
              isAction
                 ? cn("bg-secondary text-secondary-foreground", !compacto && "text-base sm:text-lg")
                : "bg-card text-card-foreground ring-1 ring-border",
            )}
          >
            {key === "borrar" ? <Delete className="size-7" /> : key === "limpiar" ? "Limpiar" : key}
          </button>
        );
      })}
    </div>
  );
}
