import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConTotp } from "@/components/totp-provider";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError, nuevaLlave } from "@/lib/api/client";
import { fechaCorta, instante, telefonoVisible } from "@/lib/api/formato";
import { altaNegocio, portafolios, type CuerpoAltaNegocio, type Modulo, type RespuestaAltaNegocio } from "@/lib/api/staff";
import { errorStaff, SelectorZona } from "./comun";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

const MSG: Record<string, string> = {
  telefono_invalido: "Revisa el teléfono del dueño.",
  correo_invalido: "Revisa el correo del dueño.",
  moneda_invalida: "La moneda no es válida.",
  zona_horaria_invalida: "Esa zona horaria no existe",
  modulos_invalidos: "Elige al menos un módulo.",
  dias_invalidos: "Los días de prueba deben ser de 1 a 90.",
  limite_tarjetas_invalido: "El límite de tarjetas debe ser de 1 a 50.",
  nombre_requerido: "Escribe el nombre del dueño y el del negocio.",
  texto_invalido: "Revisa los textos: alguno es muy largo o tiene caracteres no válidos.",
  idempotency_conflicto: "Esa alta ya se hizo con otros datos. Revisa la lista de negocios",
};

const enRango = (v: string, a: number, b: number) => /^\d+$/.test(v) && Number(v) >= a && Number(v) <= b;

export function NuevoNegocio({ abierto, onAbierto, onCreado, onIrWhatsapp }: {
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  onCreado: () => void;
  onIrWhatsapp: () => void;
}) {
  const movil = useIsMobile();
  const conTotp = useConTotp();
  const { data: pf } = useQuery({ queryKey: ["portafolios"], queryFn: portafolios, enabled: abierto });
  const [lada, setLada] = useState("+52");
  const [tel, setTel] = useState("");
  const [nombre, setNombre] = useState("");
  const [ap, setAp] = useState("");
  const [am, setAm] = useState("");
  const [correo, setCorreo] = useState("");
  const [comercial, setComercial] = useState("");
  const [giro, setGiro] = useState("");
  const [zona, setZona] = useState("America/Mexico_City");
  const [modulos, setModulos] = useState<Modulo[]>(["monedero", "tarjetas_sellos"]);
  const [limite, setLimite] = useState("1");
  const [dias, setDias] = useState("30");
  const [portafolio, setPortafolio] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [titular, setTitular] = useState(false);
  const [listo, setListo] = useState<RespuestaAltaNegocio | null>(null);
  const llave = useRef<string>("");
  const refForm = useDesplazarAlAbrir<HTMLFieldSetElement>(abierto, true);

  useEffect(() => {
    if (abierto) {
      llave.current = `alta-${nuevaLlave()}`;
      setListo(null);
    }
  }, [abierto]);

  const ladaOk = /^\+\d{1,4}$/.test(lada);
  const formOk =
    ladaOk && tel.length === 10 && nombre.trim() && /^\S+@\S+\.\S+$/.test(correo.trim()) && comercial.trim() && zona &&
    modulos.length > 0 && enRango(limite, 1, 50) && enRango(dias, 1, 90);

  const cuerpo = (titular_confirmado: boolean): CuerpoAltaNegocio => ({
    telefono: `${lada}${tel}`,
    nombre: nombre.trim(),
    apellido_paterno: ap.trim() || null,
    apellido_materno: am.trim() || null,
    correo: correo.trim(),
    nombre_comercial: comercial.trim(),
    giro: giro.trim() || null,
    moneda: "MXN",
    zona_horaria: zona,
    modulos,
    limite_tarjetas_activas: Number(limite),
    dias_prueba: Number(dias),
    portafolio_id: portafolio || null,
    titular_confirmado,
    idempotency_key: llave.current,
  });

  const enviar = async (confirmado: boolean) => {
    setEnviando(true);
    try {
      const r = await conTotp(() => altaNegocio(cuerpo(confirmado)));
      setTitular(false);
      setListo(r);
      onCreado();
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setTitular(false);
      if (err?.codigo === "nombre_no_coincide") return setTitular(true);
      if (err?.codigo === "idempotency_conflicto") llave.current = `alta-${nuevaLlave()}`;
      if (err?.codigo === "sin_capacidad_whatsapp") {
        toast.error("No hay lugares en WhatsApp: da de alta o activa un portafolio", { action: { label: "Ir a WhatsApp", onClick: onIrWhatsapp } });
        return;
      }
      errorStaff(e, MSG);
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = <T,>(set: (v: T) => void) => (v: T) => { set(v); };
  const libres = (pf?.portafolios ?? []).filter((p) => p.estado === "activo" && p.libres > 0);

  return (
    <Sheet open={abierto} onOpenChange={(o) => !enviando && onAbierto(o)}>
      <SheetContent side={movil ? "bottom" : "right"} className={movil ? "max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-24" : "w-full overflow-y-auto sm:max-w-lg"}>
        <SheetHeader className="text-left">
          <SheetTitle>Nuevo negocio</SheetTitle>
          <SheetDescription>El dueño recibe una invitación por WhatsApp para definir su PIN.</SheetDescription>
        </SheetHeader>
        {listo ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-lg font-semibold">
              Negocio creado. Prueba hasta el {fechaCorta(listo.membresia.fecha_vencimiento)}. WhatsApp: {listo.whatsapp ? telefonoVisible(listo.whatsapp.numero_whatsapp) : "sin número"}.
            </p>
            {listo.repetido && <p className="text-sm text-muted-foreground">Esta alta ya se había registrado.</p>}
            <p className="text-sm">
              {listo.invitacion_vence_en
                ? `Le enviamos una invitación por WhatsApp para definir su PIN; vence el ${instante(listo.invitacion_vence_en)}`
                : "La persona ya tenía cuenta: le avisamos de su negocio nuevo"}
            </p>
            <Button size="lg" onClick={() => onAbierto(false)}>Cerrar</Button>
          </div>
        ) : (
          <fieldset ref={refForm} disabled={enviando} className="mt-4 flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Dueño</h3>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nn-tel">Teléfono</Label>
                <div className="flex gap-2">
                  <Input aria-label="Lada" className="h-11 w-20" value={lada} onChange={(e) => cambiar(setLada)("+" + e.target.value.replace(/\D/g, "").slice(0, 4))} />
                  <Input id="nn-tel" inputMode="numeric" placeholder="55 1234 5678" className="h-11 flex-1" value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                </div>
              </div>
              <Campo id="nn-nom" etiqueta="Nombre" valor={nombre} onChange={setNombre} max={100} />
              <div className="grid grid-cols-2 gap-3">
                <Campo id="nn-ap" etiqueta="Apellido paterno" valor={ap} onChange={setAp} max={100} />
                <Campo id="nn-am" etiqueta="Apellido materno" valor={am} onChange={setAm} max={100} />
              </div>
              <Campo id="nn-correo" etiqueta="Correo" valor={correo} onChange={setCorreo} max={254} tipo="email"
                ayuda="Obligatorio: el dueño recupera su acceso por WhatsApp y correo." />
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Negocio</h3>
              <Campo id="nn-com" etiqueta="Nombre comercial" valor={comercial} onChange={setComercial} max={150} />
              <Campo id="nn-giro" etiqueta="Giro (opcional)" valor={giro} onChange={setGiro} max={100} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nn-zona">Zona horaria</Label>
                <SelectorZona id="nn-zona" valor={zona} onChange={setZona} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Módulos</span>
                {([["monedero", "Monedero"], ["tarjetas_sellos", "Tarjetas de sellos"]] as const).map(([m, l]) => (
                  <label key={m} className="flex items-center gap-3 text-base">
                    <Checkbox checked={modulos.includes(m)} onCheckedChange={(v) => setModulos((xs) => (v ? [...new Set([...xs, m])] : xs.filter((x) => x !== m)))} />
                    {l}
                  </label>
                ))}
                {modulos.length === 0 && <p className="text-sm text-destructive">Elige al menos uno.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="nn-lim" etiqueta="Límite de tarjetas (1–50)" valor={limite} onChange={(v) => setLimite(v.replace(/\D/g, "").slice(0, 2))} numerico />
                <Campo id="nn-dias" etiqueta="Días de prueba (1–90)" valor={dias} onChange={(v) => setDias(v.replace(/\D/g, "").slice(0, 2))} numerico />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nn-pf">Portafolio de WhatsApp</Label>
                <select id="nn-pf" value={portafolio} onChange={(e) => setPortafolio(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-base">
                  <option value="">Automático</option>
                  {libres.map((p) => <option key={p.portafolio_id} value={p.portafolio_id}>{p.portafolio_id} · {telefonoVisible(p.numero_whatsapp)} · {p.libres} libres</option>)}
                </select>
              </div>
            </section>
            <Button size="lg" disabled={!formOk || enviando} onClick={() => void enviar(false)}>{enviando ? "Creando…" : "Crear negocio"}</Button>
          </fieldset>
        )}
        <AlertDialog open={titular} onOpenChange={(o) => !enviando && setTitular(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿El teléfono es del dueño?</AlertDialogTitle>
              <AlertDialogDescription>
                Ese teléfono ya está registrado con otro nombre. ¿Confirmaste con el dueño que el número es suyo (por ejemplo, 'Yola' y 'Yolanda')?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
              <Button disabled={enviando} onClick={() => void enviar(true)}>{enviando ? "Enviando…" : "Sí, es suyo"}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function Campo({ id, etiqueta, valor, onChange, max, tipo, ayuda, numerico }: {
  id: string; etiqueta: string; valor: string; onChange: (v: string) => void; max?: number; tipo?: string; ayuda?: string; numerico?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} type={tipo} inputMode={numerico ? "numeric" : undefined} maxLength={max} className="h-11" value={valor} onChange={(e) => onChange(e.target.value)} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
