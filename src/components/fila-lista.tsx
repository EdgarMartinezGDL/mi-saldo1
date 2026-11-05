import { User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Initials avatar for list rows: first letters of the first two words, uppercase. */
export function Iniciales({ nombre, className }: { nombre: string; className?: string }) {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary", className)}
    >
      {letras || <User className="size-5" />}
    </span>
  );
}

type Tono = "primary" | "success" | "warning" | "accent" | "neutro";

const TONOS: Record<Tono, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning-icono",
  accent: "bg-accent/10 text-accent",
  neutro: "bg-muted text-muted-foreground",
};

/** Icon tile with a 10–12 % tinted background in the given tone. */
export function IconoTono({ icono: Icono, tono = "primary", className }: { icono: LucideIcon; tono?: Tono; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-xl", TONOS[tono], className)}>
      <Icono className="size-6" />
    </span>
  );
}
