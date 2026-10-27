import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConTotp } from "@/components/totp-provider";
import { autorizarRestablecimiento, estadoRestablecimiento, type EstadoRestablecimiento, type MotivoRestablecimiento } from "@/lib/api/staff";
import { ConfirmarMotivo, errorStaff } from "./comun";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

const MOTIVOS_PIN: Record<MotivoRestablecimiento, string> = {
  tiene_correo: "Tiene correo registrado: que use «Olvidé mi PIN».",
  sin_rol_negocio: "Solo dueños y empleados.",
  cuenta_sin_activar: "La cuenta aún no se activa: reenvía su invitación.",
  es_staff: "Los miembros de Staff no se restablecen aquí.",
  persona_eliminada: "La persona se eliminó.",
  propio: "Tu propio PIN lo recuperas con «Olvidé mi PIN».",
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
export const motivoPinValido = (m: string) => m.trim().length >= 5 && m.trim().length <= 500;

export function RestablecerPinStaff({ personaId, nombre, abierto, onAbrir, onCerrar }: {
  personaId: string; nombre: string; abierto: boolean; onAbrir: () => void; onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoRestablecimiento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const conTotp = useConTotp();
  const ref = useDesplazarAlAbrir(abierto, true);
  const cargar = async () => {
    try { setEstado(await estadoRestablecimiento(personaId)); setError(false); }
    catch (e) { setError(true); errorStaff(e); }
  };
  useEffect(() => {
    let vigente = true;
    setEstado(null); setMotivo(""); setResultado(null); setConfirmar(false); setError(false);
    estadoRestablecimiento(personaId).then((s) => { if (vigente) setEstado(s); })
      .catch((e) => { if (vigente) { setError(true); errorStaff(e); } });
    return () => { vigente = false; };
  }, [personaId]);
  return <div className="flex flex-col gap-2">
    <Button size="sm" variant="secondary" className="self-start" disabled={!estado?.puede} onClick={onAbrir}>Restablecer PIN</Button>
    {estado?.motivo && !estado.puede && <p className="text-sm text-muted-foreground">{MOTIVOS_PIN[estado.motivo]}</p>}
    {error && <Button size="sm" variant="ghost" className="self-start" onClick={() => void cargar()}>Volver a revisar</Button>}
    {estado?.enlace_vigente_hasta && <p className="text-sm text-muted-foreground">Hay un enlace vigente hasta las {hora(estado.enlace_vigente_hasta)}; si autorizas otro, el anterior deja de servir.</p>}
    {resultado && <p role="status" className="text-sm">{resultado}</p>}
    {abierto && estado?.puede && <div ref={ref} className="grid gap-3 rounded-xl p-3 ring-1 ring-border">
      <p className="text-sm text-muted-foreground">Antes de autorizar, verifica su identidad por llamada o identificación. Le llegará un enlace por WhatsApp para que defina su PIN; tú nunca lo ves.</p>
      <Label htmlFor="pin-motivo">Motivo</Label>
      <Textarea id="pin-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onCerrar}>Cancelar</Button>
        <Button disabled={!motivoPinValido(motivo)} onClick={() => setConfirmar(true)}>Enviar enlace por WhatsApp</Button></div>
    </div>}
    <ConfirmarMotivo abierto={confirmar} onAbierto={setConfirmar} titulo={`¿Enviar el enlace a ${nombre}?`} boton="Enviar enlace por WhatsApp" pideMotivo={false}
      listo={!!estado?.puede && motivoPinValido(motivo)} accion={async () => {
        try {
          const r = await conTotp(() => autorizarRestablecimiento(personaId, motivo.trim()));
          const texto = `Enviamos el enlace por WhatsApp a ${r.telefono}; vence a las ${hora(r.expira_en)}`;
          setResultado(texto); toast.success(texto); setConfirmar(false); setMotivo(""); onCerrar(); await cargar();
        } catch (e) { errorStaff(e); throw e; }
      }} />
  </div>;
}