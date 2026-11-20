import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CopiarEnlace({ enlace, campoVisible = false, enQr = false }: { enlace: string; campoVisible?: boolean; enQr?: boolean }) {
  const campo = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState("");
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setCopiado(false); setMensaje(""); }, [enlace]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copiar = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true); setMensaje("Enlace copiado");
      timer.current = setTimeout(() => { setCopiado(false); setMensaje(""); }, 2000);
    } catch {
      setCopiado(false); setMensaje("Mantén presionado el enlace para copiarlo");
      requestAnimationFrame(() => { campo.current?.focus(); campo.current?.select(); });
    }
  };
  return <div className="w-full max-w-md space-y-2">
    <div className="flex flex-col gap-2 sm:flex-row">
      {(campoVisible || (mensaje && !copiado)) && <Input ref={campo} readOnly value={enlace} aria-label="Enlace de registro" onFocus={(e) => e.currentTarget.select()} className={`min-h-12 min-w-0 text-base md:text-base ${enQr ? "!border-qr-texto !bg-qr-fondo !text-qr-texto" : ""}`} />}
      <Button variant="secondary" className={`min-h-12 shrink-0 text-base ${enQr ? "border border-qr-texto bg-qr-fondo text-qr-texto hover:bg-qr-fondo" : ""}`} onClick={() => void copiar()}>{copiado ? <Check /> : <Copy />}{copiado ? "¡Copiado!" : "Copiar enlace"}</Button>
    </div>
    <p aria-live="polite" className="text-sm">{mensaje}</p>
  </div>;
}