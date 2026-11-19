import { forwardRef, useEffect, useId, useRef, useState, type ComponentProps, type RefObject } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Reveal state is local and cleared before the enclosing form handles submit. */
export function useRevelarSecreto(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const ocultar = () => setVisible(false);
    form?.addEventListener("submit", ocultar, true);
    return () => form?.removeEventListener("submit", ocultar, true);
  }, [ref]);
  return { visible, setVisible };
}

export function OjoSecreto({ visible, onClick, etiqueta = "PIN", controls }: {
  visible: boolean; onClick: () => void; etiqueta?: string; controls: string;
}) {
  return <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground [&_svg]:size-5"
    aria-label={`${visible ? "Ocultar" : "Mostrar"} ${etiqueta}`} aria-pressed={visible} aria-controls={controls}
    onPointerDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); onClick(); }}>
    {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
  </Button>;
}

export const CampoPin = forwardRef<HTMLInputElement, Omit<ComponentProps<typeof Input>, "type"> & { etiquetaMostrar?: string }>(
  ({ id, className, etiquetaMostrar = "PIN", ...props }, ref) => {
    const generado = useId();
    const campoId = id ?? generado;
    const interno = useRef<HTMLInputElement>(null);
    const { visible, setVisible } = useRevelarSecreto(interno);
    return <span className="grid min-w-0 w-full items-center">
      <Input {...props} id={campoId} type={visible ? "text" : "password"}
        className={cn(className, "col-start-1 row-start-1 pr-14")}
        ref={(nodo) => { interno.current = nodo; if (typeof ref === "function") ref(nodo); else if (ref) ref.current = nodo; }} />
      <span className="z-10 col-start-1 row-start-1 mr-1 justify-self-end">
        <OjoSecreto visible={visible} etiqueta={etiquetaMostrar} controls={campoId}
          onClick={() => { setVisible((v) => !v); interno.current?.focus({ preventScroll: true }); }} />
      </span>
    </span>;
  },
);
CampoPin.displayName = "CampoPin";