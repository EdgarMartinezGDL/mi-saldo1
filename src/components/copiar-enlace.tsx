import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function mensajeCompartir(nombreNegocio?: string) {
  return `${nombreNegocio ? `Únete a ${nombreNegocio} en Mi Saldo Vip` : "Únete a Mi Saldo Vip"} y gana cashback en cada compra:`;
}

export function CopiarEnlace({ enlace, campoVisible = false, enQr = false, nombreNegocio }: { enlace: string; campoVisible?: boolean; enQr?: boolean; nombreNegocio?: string }) {
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
  const compartir = async () => {
    const texto = mensajeCompartir(nombreNegocio);
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: "Mi Saldo Vip", text: texto, url: enlace }); return; }
      catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; if ((e as { name?: string })?.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${enlace}`)}`, "_blank", "noopener,noreferrer");
  };
  const estiloBoton = `min-h-12 shrink-0 text-base ${enQr ? "border border-qr-texto bg-qr-fondo text-qr-texto hover:bg-qr-fondo" : ""}`;
  return <div className="w-full max-w-md space-y-2">
    <div className="flex flex-col gap-2 sm:flex-row">
      {(campoVisible || (mensaje && !copiado)) && <Input ref={campo} readOnly value={enlace} aria-label="Enlace de registro" onFocus={(e) => e.currentTarget.select()} className={`min-h-12 min-w-0 text-base md:text-base ${enQr ? "!border-qr-texto !bg-qr-fondo !text-qr-texto" : ""}`} />}
      <Button variant="secondary" className={estiloBoton} onClick={() => void copiar()}>{copiado ? <Check /> : <Copy />}{copiado ? "¡Copiado!" : "Copiar enlace"}</Button>
      <Button variant="secondary" className={estiloBoton} onClick={() => void compartir()}><Share2 />Compartir</Button>
    </div>
    <p aria-live="polite" className="text-sm">{mensaje}</p>
  </div>;
}