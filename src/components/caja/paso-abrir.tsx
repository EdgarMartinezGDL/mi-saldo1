import { Link } from "@tanstack/react-router";
import { CreditCard, KeyRound, Lock } from "lucide-react";
import { useRef, useState } from "react";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Button } from "@/components/ui/button";
import { abrirCaja } from "@/lib/api/caja";
import type { Rol } from "@/lib/api/client";
import { avisarError } from "./caja-contexto";
import { Tecla, useConMouse, useDigitos, useTecla } from "./teclado";

/** 6-digit PIN POS entry (full screen or inside the interruption dialog). */
export function PinPos({ onAbierta, compacto }: { onAbierta: (venceEn: string) => void; compacto?: boolean }) {
  const conMouse = useConMouse();
  const ref = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    if (ocupado || pin.length !== 6) return;
    setOcupado(true);
    try {
      const r = await abrirCaja(pin);
      onAbierta(r.vence_en);
    } catch (e) {
      avisarError(e);
    } finally {
      setPin("");
      setOcupado(false);
    }
  };
  const onKey = (k: string) => {
    if (ocupado) return;
    if (k === "borrar") setPin((p) => p.slice(0, -1));
    else if (k === "limpiar") setPin("");
    else setPin((p) => p.length < 6 ? p + k : p);
  };
  useDigitos(onKey, { activo: !ocupado, ref });
  useTecla((e) => { if (e.key === "Enter" && pin.length === 6) { void enviar(); return true; } return false; }, { activo: !ocupado, ref });
  return (
    <div ref={ref} className={compacto ? "" : "rounded-2xl bg-card p-5 ring-1 ring-border"}>
      <p className="flex items-center gap-2 text-sm uppercase tracking-[0.12em] text-muted-foreground"><Lock className="size-4" /> PIN POS</p>
      {conMouse && <p className="mt-2 text-base text-muted-foreground">Escribe el PIN con el teclado y presiona Enter.</p>}
      <p className="mt-2 flex gap-2" aria-label={`${pin.length} de 6 dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="grid h-14 flex-1 place-items-center rounded-xl bg-secondary font-mono text-3xl font-bold">{pin[i] ? "•" : ""}</span>
        ))}
      </p>
      <NumericKeypad compacto={conMouse} className="mt-4" onKey={onKey} />
      <Button size="lg" className="mt-4 h-14 w-full text-lg" disabled={ocupado || pin.length !== 6} onClick={() => void enviar()}>
        <Lock className="size-5" /> {ocupado ? "Abriendo…" : "Abrir caja"}<Tecla>Enter</Tecla>
      </Button>
    </div>
  );
}

export function PasoAbrir({ negocio, onAbierta }: { negocio: string; onAbierta: (venceEn: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Caja de {negocio}</h1>
        <p className="mt-1 text-base text-muted-foreground">Escribe el PIN POS del negocio para abrir la caja.</p>
      </div>
      <PinPos onAbierta={onAbierta} />
    </div>
  );
}

/** Caja closed for everyone: no PIN POS yet, or membership blocked. */
export function PasoBloqueo({ motivo, negocio, rol }: { motivo: "sin_pin" | "membresia"; negocio: string; rol: Rol }) {
  const dueno = rol === "dueno";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">Caja de {negocio}</h1>
      <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
        <p className="text-lg font-semibold">
          {motivo === "membresia"
            ? "La caja está bloqueada hasta que el negocio registre su pago."
            : dueno ? "Aún no defines el PIN POS." : "El dueño aún no define el PIN POS."}
        </p>
        {motivo === "sin_pin" && dueno && (
          <Button asChild size="lg" className="mt-5 h-14 w-full text-lg">
            <Link to="/negocio/pin-pos"><KeyRound className="size-5" /> Definir PIN POS</Link>
          </Button>
        )}
        {motivo === "membresia" && dueno && (
          <Button asChild size="lg" className="mt-5 h-14 w-full text-lg">
            <Link to="/negocio/membresia"><CreditCard className="size-5" /> Pagar membresía</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
