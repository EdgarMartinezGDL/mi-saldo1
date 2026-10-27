import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AvisoPrivacidad } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { telefonoE164 } from "@/lib/api/client";
import { altaCliente, configReferidos, type AltaRespuesta } from "./caja-extra";
import { avisarError, EncabezadoPaso, useCaja } from "./caja-contexto";
import { useConsentimiento } from "@/lib/api/privacidad";
import { Alerta } from "@/components/enlace-ui";
import { ApiError } from "@/lib/api/client";

import { Tecla, useConMouse, useFocoCaja, useTecla } from "./teclado";

const campo = "h-14 text-base";
const digitos = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);

export function PasoAlta({ telefono, onVolver, onHecha }: { telefono: string; onVolver: () => void; onHecha: (r: AltaRespuesta) => void }) {
  const conMouse = useConMouse();
  const nombreRef = useRef<HTMLInputElement>(null);
  useFocoCaja(nombreRef);
  const { ejecutar } = useCaja();
  const [nombre, setNombre] = useState("");
  const [paterno, setPaterno] = useState("");
  const [materno, setMaterno] = useState("");
  const [correo, setCorreo] = useState("");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [referidor, setReferidor] = useState("");
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [error, setError] = useState<string | null>(null);
  const [conReferidos, setConReferidos] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    configReferidos().then((c) => setConReferidos(c.activo && c.disponible === true)).catch(() => setConReferidos(false));
  }, []);

  const nacimientoOk = (dia === "") === (mes === "");
  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const listo = nombre.trim().length > 0 && correoOk && aviso && !!version && nacimientoOk && (referidor === "" || referidor.length === 10);

  const enviar = async () => {
    if (!listo || !version || ocupado) return;
    setError(null);
    setOcupado(true);
    try {
      const r = await ejecutar(() => altaCliente({
        telefono: telefonoE164(telefono),
        nombre: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        ...(paterno.trim() ? { apellido_paterno: paterno.trim() } : {}),
        ...(materno.trim() ? { apellido_materno: materno.trim() } : {}),
        ...(dia && mes ? { nacimiento_dia: Number(dia), nacimiento_mes: Number(mes) } : {}),
        ...(conReferidos && referidor ? { referidor_telefono: telefonoE164(referidor) } : {}),
        acepta_aviso_privacidad: true,
        version_aviso: version,
      }));
      onHecha(r);
    } catch (e) {
      if (desactualizado(e)) { setError(e instanceof ApiError ? String(e.extras["message"] ?? e.message) : ""); return; }
      avisarError(e);
    } finally {
      setOcupado(false);
    }
  };

  useTecla((e) => { if (e.key === "Escape") { onVolver(); return true; } return false; }, { activo: !ocupado, inclusoEnCampos: true });
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <EncabezadoPaso titulo="Dar de alta" subtitulo={`Teléfono ${telefono.slice(0, 2)} ${telefono.slice(2, 6)} ${telefono.slice(6)}`} onVolver={onVolver} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (listo && !ocupado) void enviar(); }} onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (e.repeat) { e.preventDefault(); return; }
        if (e.target instanceof HTMLElement && e.target.getAttribute("role") === "checkbox") {
          e.preventDefault();
          if (listo && !ocupado) void enviar();
        }
      }} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex flex-col gap-2"><Label htmlFor="alta-nombre" className="text-base">Nombre</Label>
          <Input ref={nombreRef} data-sin-centrar={conMouse ? "" : undefined} id="alta-nombre" className={campo} maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="alta-paterno" className="text-base">Apellido paterno (opcional)</Label>
          <Input id="alta-paterno" className={campo} maxLength={100} value={paterno} onChange={(e) => setPaterno(e.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="alta-materno" className="text-base">Apellido materno (opcional)</Label>
          <Input id="alta-materno" className={campo} maxLength={100} value={materno} onChange={(e) => setMaterno(e.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="alta-correo" className="text-base">Correo electrónico</Label>
          <Input id="alta-correo" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={255} placeholder="cliente@ejemplo.mx" className={campo} value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <p className="text-sm text-muted-foreground">Le avisaremos de sus compras y canjes por WhatsApp y por este correo.</p>
          {correo !== "" && !correoOk && <p className="text-sm text-destructive">Revisa el correo: debe tener la forma nombre@dominio.com.</p>}
        </div>
        <div>
          <p className="mb-2 text-base font-medium">Cumpleaños (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input aria-label="Día" placeholder="Día" inputMode="numeric" className={campo} value={dia} onChange={(e) => setDia(digitos(e.target.value, 2))} />
            <Input aria-label="Mes" placeholder="Mes (1–12)" inputMode="numeric" className={campo} value={mes} onChange={(e) => setMes(digitos(e.target.value, 2))} />
          </div>
          {!nacimientoOk && <p className="mt-1 text-sm text-destructive">Escribe el día y el mes, o deja los dos vacíos.</p>}
        </div>
        {conReferidos && (
          <div className="flex flex-col gap-2"><Label htmlFor="alta-ref" className="text-base">¿Quién te recomendó? (teléfono)</Label>
            <Input id="alta-ref" inputMode="numeric" className={campo} placeholder="10 dígitos" value={referidor} onChange={(e) => setReferidor(digitos(e.target.value, 10))} /></div>
        )}
        {error && <Alerta>{error}</Alerta>}
        <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />
        <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={!listo || ocupado}>
          <UserPlus className="size-5" /> {ocupado ? "Registrando…" : "Dar de alta"}<Tecla>Enter</Tecla>
        </Button>
      </form>
    </div>
  );
}
