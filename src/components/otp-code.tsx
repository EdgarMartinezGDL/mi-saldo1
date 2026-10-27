import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Six-digit redemption code. Hidden by default; the customer must hold the eye
 * button down to reveal it and it hides again on release.
 */
export function OtpCode({ code, className }: { code: string; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    window.addEventListener("pointerup", hide);
    window.addEventListener("pointercancel", hide);
    return () => {
      window.removeEventListener("pointerup", hide);
      window.removeEventListener("pointercancel", hide);
    };
  }, [visible]);

  const digits = code.split("");

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <div className="flex min-w-0 flex-1 gap-1.5" aria-live="polite">
        {digits.map((digit, i) => (
          <span
            key={i}
            className={cn(
              "grid h-16 flex-1 place-items-center rounded-xl bg-secondary font-mono text-3xl font-bold tabular-nums transition-all sm:h-20 sm:text-4xl",
              visible ? "text-foreground" : "text-muted-foreground blur-[6px]",
            )}
          >
            {visible ? digit : "•"}
          </span>
        ))}
      </div>
      <button
        type="button"
        aria-label="Mantén presionado para mostrar el código"
        aria-pressed={visible}
        onPointerDown={() => setVisible(true)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") setVisible(true);
        }}
        onKeyUp={() => setVisible(false)}
        onBlur={() => setVisible(false)}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "grid size-16 shrink-0 select-none place-items-center rounded-2xl transition-transform active:scale-95",
          visible ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
        )}
      >
        <Eye className="size-7" />
      </button>
      <p className="w-full text-sm font-medium text-muted-foreground">
        {visible ? "Dicta el código al cajero" : "Mantén presionado el ojo para revelar"}
      </p>
    </div>
  );
}
