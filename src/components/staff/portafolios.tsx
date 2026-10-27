import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { instante, telefonoVisible } from "@/lib/api/formato";
import {
  capacidadPortafolio, crearPortafolio, estadoPortafolio, migrarPortafolio, portafolios,
  type EstadoPortafolio, type Portafolio,
} from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { avisoPrueba } from "@/lib/api/staff";
import { ConfirmarMotivo, errorStaff, NOTA_AUDITORIA, useNivelStaff } from "./comun";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { plural } from "@/lib/plural";

const CHIP: Record<EstadoPortafolio, { l: string; c: string }> = {
  preparando: { l: "Preparando", c: "bg-secondary text-foreground" },
  activo: { l: "Activo", c: "bg-primary/15 text-primary" },
  pausado: { l: "Pausado", c: "bg-warn/15 text-warn" },
  retirado: { l: "Retirado", c: "bg-destructive/10 text-destructive" },
};

const MSG: Record<string, string> = {
  portafolio_invalido: "El identificador solo admite letras, números, punto, guion y guion bajo (1 a 100).",
  plantillas_sin_confirmar: "Confirma que las 20 plantillas están aprobadas antes de activarlo.",
  no_encontrado: "Ese portafolio ya no existe.",
  capacidad_invalida: "La capacidad debe ser de 1 a 500.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
};

const TRANSICIONES: Record<EstadoPortafolio, EstadoPortafolio[]> = {
  preparando: ["activo"],
  activo: ["pausado", "retirado"],
  pausado: ["activo", "retirado"],
  retirado: [],
};
const VERBO: Record<EstadoPortafolio, string> = { activo: "Activar", pausado: "Pausar", retirado: "Retirar", preparando: "" };

export const QK_PORTAFOLIOS = ["portafolios"];

export function PestanaWhatsapp() {
  const { esAdmin } = useNivelStaff();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: QK_PORTAFOLIOS, queryFn: portafolios });
  const [nuevo, setNuevo] = useState(false);
  const recargar = () => void qc.invalidateQueries({ queryKey: QK_PORTAFOLIOS });

  if (error) return <p className="text-sm text-destructive">No se pudieron cargar los portafolios.</p>;
  if (!data) return <Cargando />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-base font-semibold", data.alerta_capacidad && "text-destructive")}>
          {data.lugares_libres} lugares libres · {data.negocios_sin_whatsapp} negocios sin número
        </p>
        <div className="flex flex-wrap gap-2">
          <AvisoPrueba negocioId={null} texto="Enviarme un aviso de prueba" />
          {esAdmin && <Button onClick={() => setNuevo(true)}><Plus className="size-4" /> Nuevo portafolio</Button>}
        </div>
      </div>
      {data.portafolios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay portafolios.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.portafolios.map((p) => <TarjetaPortafolio key={p.portafolio_id} p={p} admin={esAdmin} onCambio={recargar} />)}
        </ul>
      )}
      <NuevoPortafolio abierto={nuevo} onAbierto={setNuevo} onCreado={recargar} />
    </div>
  );
}

function TarjetaPortafolio({ p, admin, onCambio }: { p: Portafolio; admin: boolean; onCambio: () => void }) {
  const [destino, setDestino] = useState<EstadoPortafolio | null>(null);
  const [plantillas, setPlantillas] = useState(false);
  const [migrar, setMigrar] = useState(false);
  const cap = useModoEdicion<string>(String(p.capacidad));
  const [guardando, setGuardando] = useState(false);
  const [confCap, setConfCap] = useState(false);
  const capOk = /^\d+$/.test(cap.valores) && Number(cap.valores) >= 1 && Number(cap.valores) <= 500;
  const opciones = TRANSICIONES[p.estado].filter((e) => e !== "retirado" || p.asignados === 0);

  const guardarCapacidad = async () => {
    setGuardando(true);
    try {
      await capacidadPortafolio(p.portafolio_id, Number(cap.valores));
      toast.success("Capacidad actualizada");
      setConfCap(false);
      cap.terminar(cap.valores);
      onCambio();
    } catch (e) {
      errorStaff(e, MSG);
      throw e;
    } finally {
      setGuardando(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-base font-semibold">{p.portafolio_id}</p>
          <p className="text-sm text-muted-foreground">{telefonoVisible(p.numero_whatsapp)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", CHIP[p.estado].c)}>{CHIP[p.estado].l}</span>
      </div>
      <div>
        <p className="text-sm">{p.asignados} de {p.capacidad}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (p.asignados / Math.max(1, p.capacidad)) * 100)}%` }} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {p.plantillas_confirmadas_en ? `Plantillas confirmadas el ${instante(p.plantillas_confirmadas_en)}` : "Plantillas sin confirmar"}
      </p>
      {p.nota && <p className="text-sm text-muted-foreground">{p.nota}</p>}
      {admin && p.estado !== "retirado" && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            {opciones.map((e) => (
              <Button key={e} size="sm" variant={e === "retirado" ? "ghost" : "secondary"} className={e === "retirado" ? "text-destructive" : ""}
                onClick={() => { setPlantillas(false); setDestino(e); }}>
                {VERBO[e]}
              </Button>
            ))}
            {p.asignados > 0 && <Button size="sm" variant="ghost" onClick={() => setMigrar(true)}>Migrar sus negocios</Button>}
          </div>
          {cap.editando ? (
            <div ref={cap.ref} className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`cap-${p.portafolio_id}`} className="text-xs">Capacidad (1–500)</Label>
                <Input id={`cap-${p.portafolio_id}`} inputMode="numeric" className="h-10 w-24" value={cap.valores}
                  onChange={(e) => cap.setValores(e.target.value.replace(/\D/g, "").slice(0, 3))} />
              </div>
              <BotonesEdicion ocupado={guardando} cambiado={cap.cambiado && capOk} onGuardar={() => setConfCap(true)} onCancelar={cap.cancelar} />
            </div>
          ) : (
            <VistaLectura datos={[{ etiqueta: "Capacidad", valor: cap.guardado }]} onEditar={cap.editar} />
          )}
        </div>
      )}
      <ConfirmarMotivo
        abierto={!!destino}
        onAbierto={(o) => !o && setDestino(null)}
        titulo={destino ? `¿${VERBO[destino]} ${p.portafolio_id}?` : ""}
        boton={destino ? `Sí, ${VERBO[destino].toLowerCase()}` : ""}
        destructivo={destino === "retirado"}
        nota={NOTA_AUDITORIA}
        listo={destino !== "activo" || p.estado !== "preparando" || plantillas}
        extra={destino === "activo" && p.estado === "preparando" ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={plantillas} onCheckedChange={(v) => setPlantillas(v === true)} className="mt-0.5" />
            Confirmo que las 20 plantillas de negocio están aprobadas en este portafolio de Meta
          </label>
        ) : undefined}
        accion={async (motivo) => {
          if (!destino) return;
          try {
            await estadoPortafolio(p.portafolio_id, { estado: destino, plantillas_confirmadas: destino === "activo" && plantillas, motivo });
            toast.success(`${p.portafolio_id}: ${CHIP[destino].l.toLowerCase()}`);
            setDestino(null);
            onCambio();
          } catch (e) {
            errorStaff(e, MSG);
            throw e;
          }
        }}
      />
      <ConfirmarMotivo abierto={confCap} onAbierto={setConfCap} pideMotivo={false}
        titulo={`¿Cambiar la capacidad de ${p.portafolio_id} de ${p.capacidad} a ${cap.valores}?`} boton="Sí, cambiar" accion={guardarCapacidad} />
      <ConfirmarMotivo
        abierto={migrar}
        onAbierto={setMigrar}
        titulo={`¿Migrar los negocios de ${p.portafolio_id}?`}
        descripcion="Mueve todos sus negocios a los demás portafolios activos (todo o nada) y lo deja pausado"
        nota={NOTA_AUDITORIA}
        boton="Sí, migrar"
        accion={async (motivo) => {
          try {
            const r = await migrarPortafolio(p.portafolio_id, motivo);
            toast.success(`${plural(r.movidos, "negocio movido", "negocios movidos")}`, {
              description: Object.entries(r.reparto).map(([k, v]) => `${k}: ${v}`).join(" · "),
            });
            setMigrar(false);
            onCambio();
          } catch (e) {
            errorStaff(e, MSG);
            throw e;
          }
        }}
      />
    </li>
  );
}

function NuevoPortafolio({ abierto, onAbierto, onCreado }: { abierto: boolean; onAbierto: (v: boolean) => void; onCreado: () => void }) {
  const movil = useIsMobile();
  const [id, setId] = useState("");
  const [lada, setLada] = useState("+52");
  const [num, setNum] = useState("");
  const [cap, setCap] = useState("50");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conf, setConf] = useState(false);
  const refForm = useDesplazarAlAbrir<HTMLFieldSetElement>(abierto, true);
  const ok = /^[A-Za-z0-9._-]{1,100}$/.test(id) && /^\+\d{1,4}$/.test(lada) && num.length >= 8 && /^\d+$/.test(cap) && Number(cap) >= 1 && Number(cap) <= 500;

  const crear = async () => {
    setEnviando(true);
    try {
      const p = await crearPortafolio({ portafolio_id: id, numero_whatsapp: `${lada}${num}`, capacidad: Number(cap), nota: nota.trim() || null });
      toast.success(`Portafolio ${p.portafolio_id} creado: queda en preparación`);
      setId(""); setNum(""); setCap("50"); setNota("");
      setConf(false);
      onAbierto(false);
      onCreado();
    } catch (e) {
      errorStaff(e, MSG);
      throw e;
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet open={abierto} onOpenChange={(o) => !enviando && onAbierto(o)}>
      <SheetContent side={movil ? "bottom" : "right"} className={movil ? "max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-24" : "w-full sm:max-w-md"}>
        <SheetHeader className="text-left">
          <SheetTitle>Nuevo portafolio</SheetTitle>
          <SheetDescription>Queda en preparación hasta que confirmes sus plantillas.</SheetDescription>
        </SheetHeader>
        <fieldset ref={refForm} disabled={enviando} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-id">Identificador (tal como está en Meta)</Label>
            <Input id="np-id" maxLength={100} className="h-11 font-mono" placeholder="PF-003" value={id} onChange={(e) => setId(e.target.value.trim())} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-num">Número de WhatsApp</Label>
            <div className="flex gap-2">
              <Input aria-label="Lada" className="h-11 w-20" value={lada} onChange={(e) => setLada("+" + e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <Input id="np-num" inputMode="numeric" className="h-11 flex-1" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 12))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-cap">Capacidad (1–500)</Label>
            <Input id="np-cap" inputMode="numeric" className="h-11 w-28" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-nota">Nota (opcional)</Label>
            <Input id="np-nota" maxLength={500} className="h-11" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <Button size="lg" disabled={!ok || enviando} onClick={() => setConf(true)}>{enviando ? "Creando…" : "Crear portafolio"}</Button>
        </fieldset>
        <ConfirmarMotivo abierto={conf} onAbierto={setConf} pideMotivo={false}
          titulo={`¿Crear el portafolio ${id} con el número ${telefonoVisible(`${lada}${num}`)} y capacidad ${cap}?`}
          descripcion="Queda en preparación hasta que confirmes sus plantillas." boton="Sí, crear" accion={crear} />
      </SheetContent>
    </Sheet>
  );
}

/** Sends a test notice to oneself on every channel (soporte or admin). */
export function AvisoPrueba({ negocioId, texto }: { negocioId: string | null; texto: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setAbierto(true)}>{texto}</Button>
      <ConfirmarMotivo abierto={abierto} onAbierto={setAbierto} pideMotivo={false} titulo="¿Enviarte un aviso de prueba?"
        descripcion={negocioId ? "Te llega a ti por todos los canales, desde el número de WhatsApp de este negocio." : "Te llega a ti por todos los canales, desde el número de la plataforma."}
        boton="Sí, enviar"
        accion={async () => {
          try {
            const r = await avisoPrueba(negocioId);
            toast.success(`Te enviamos ${r.encoladas.length} ${r.encoladas.length === 1 ? "aviso" : "avisos"} de prueba`);
            setAbierto(false);
          } catch (e) { errorStaff(e); throw e; }
        }} />
    </>
  );
}
