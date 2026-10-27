import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { buscarCliente, configuracion, estadoPos, type ClienteCaja, type ConfiguracionCaja } from "@/lib/api/caja";
import { avisarError, CajaProvider, nombreCliente, OperacionCancelada, type CajaCtx } from "@/components/caja/caja-contexto";
import { ResumenCliente } from "@/components/caja/resumen-cliente";
import { FranjaCaja } from "@/components/caja/franja-caja";
import { PasoAbrir, PasoBloqueo, PinPos } from "@/components/caja/paso-abrir";
import { PasoAlta } from "@/components/caja/paso-alta";
import { PasoBuscar } from "@/components/caja/paso-buscar";
import { PasoComprobante } from "@/components/caja/paso-comprobante";
import { PasoFicha } from "@/components/caja/paso-ficha";
import { PasoAcumular, PasoCanjear, type Comprobante } from "@/components/caja/paso-operacion";
import { PasoReclamar } from "@/components/caja/paso-reclamar";
import type { AltaRespuesta } from "@/components/caja/caja-extra";
import { fueraDeHorario, horarioHoy, INTERVALO_POS } from "@/lib/caja-horario";

export const Route = createFileRoute("/caja")({
  head: () => ({
    meta: [
      { title: "Caja · MiSaldo" },
      { name: "description", content: "Punto de venta paso a paso: abrir caja, buscar cliente, acumular y canjear." },
      { property: "og:title", content: "Caja · MiSaldo" },
      { property: "og:description", content: "Caja de mostrador con teclado grande para acumular saldo, sellos y canjes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Caja" roles={["empleado", "dueno"]}>
      <Caja />
    </RequiereSesion>
  ),
});

type Estado = "cargando" | "error" | "sin_pin" | "membresia" | "cerrada" | "abierta";
type Paso = "buscar" | "alta" | "ficha" | "acumular" | "canjear" | "reclamar" | "comprobante";
type PidePin = { reintentar: () => void; cancelar: () => void };

function Caja() {
  const { sesion } = useAuth();
  const rol = sesion?.contexto.rol ?? "empleado";
  const [estado, setEstado] = useState<Estado>("cargando");
  const [config, setConfig] = useState<ConfiguracionCaja | null>(null);
  const [venceEn, setVenceEn] = useState<string | null>(null);
  const [pidePin, setPidePin] = useState<PidePin | null>(null);
  const [paso, setPaso] = useState<Paso>("buscar");
  const [telefono, setTelefono] = useState("");
  const [ficha, setFicha] = useState<ClienteCaja | null>(null);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [fuera, setFuera] = useState(false);
  const [revisando, setRevisando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [est, cfg] = await Promise.all([estadoPos(), configuracion()]);
      setConfig(cfg);
      setVenceEn(est.vence_en);
      setFuera(fueraDeHorario(rol, est));
      const m = cfg.negocio.membresia_estado;
      if (m === "vencida" || m === "suspendida") setEstado("membresia");
      else if (!est.pin_pos_configurado) setEstado("sin_pin");
      else setEstado(est.desbloqueado ? "abierta" : "cerrada");
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "membresia_vencida") setEstado("membresia");
      else { setEstado("error"); avisarError(e); }
    }
  }, [rol]);

  useEffect(() => { void cargar(); }, [cargar]);

  const revisar = useCallback(async () => {
    setRevisando(true);
    try {
      const est = await estadoPos();
      const bloqueada = fueraDeHorario(rol, est);
      setFuera(bloqueada);
      if (bloqueada) { setPaso("buscar"); setFicha(null); setComprobante(null); }
      setVenceEn(est.vence_en);
      setEstado((anterior) => anterior === "membresia" ? anterior : !est.pin_pos_configurado ? "sin_pin" : est.desbloqueado ? "abierta" : "cerrada");
    } catch (e) { avisarError(e); }
    finally { setRevisando(false); }
  }, [rol]);

  useEffect(() => {
    const timer = window.setInterval(() => { void revisar(); }, INTERVALO_POS);
    return () => window.clearInterval(timer);
  }, [revisar]);

  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const ejecutar = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const correr = async (): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.codigo === "fuera_de_horario") {
          setFuera(true);
          setFicha(null); setComprobante(null); setPaso("buscar");
          throw e;
        }
        if (e instanceof ApiError && e.codigo === "pin_pos_requerido") {
          setVenceEn(null);
          return new Promise<T>((resolve, reject) => {
            setPidePin({
              reintentar: () => { correr().then(resolve, reject); },
              cancelar: () => reject(new OperacionCancelada()),
            });
          });
        }
        if (e instanceof ApiError && e.codigo === "membresia_vencida") {
          setEstado("membresia");
          void cargarRef.current();
        }
        throw e;
      }
    };
    return correr();
  }, []);

  const recargarFicha = useCallback(async (tel: string) => {
    try {
      const r = await ejecutar(() => buscarCliente(telefonoE164(tel)));
      if (r.encontrado) setFicha(r);
    } catch { /* the receipt is already shown; the ficha reloads on "Seguir" */ }
  }, [ejecutar]);

  const ctx = useMemo<CajaCtx | null>(() => config && ({
    config,
    moneda: config.negocio.moneda,
    zona: config.negocio.zona_horaria ?? "America/Mexico_City",
    rol,
    ejecutar,
    recargarConfig: () => void cargar(),
  }), [config, rol, ejecutar, cargar]);

  const negocio = config?.negocio.nombre_comercial ?? sesion?.contexto.nombre_comercial ?? "tu negocio";

  const nuevoCliente = () => { setFicha(null); setTelefono(""); setComprobante(null); setPaso("buscar"); };
  const terminado = (c: Comprobante) => { setComprobante(c); setPaso("comprobante"); void recargarFicha(telefono); };
  const altaHecha = async (r: AltaRespuesta) => {
    if (r.pendiente) {
      setFicha(null);
      setComprobante({ titulo: "Solicitud enviada", lineas: ["Este número ya está registrado con otro nombre. Le pedimos al titular que confirme."] });
      setPaso("comprobante");
      return;
    }
    const description = [
      r.enlace_activacion_enviado ? "Le enviamos un WhatsApp para activar su app." : "",
      r.correo_capturado === "conservado_anterior" ? "Ya tenía un correo registrado; se conservó." : "",
    ].filter(Boolean).join(" ");
    toast.success("Cliente dado de alta", { description: description || undefined });
    await recargarFicha(telefono);
    setPaso("ficha");
  };

  let contenido: React.ReactNode;
  if (estado === "cargando" || !ctx) {
    contenido = estado === "error" ? (
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 ring-1 ring-border">
        <p className="text-lg font-semibold">No se pudo cargar la caja.</p>
        <Button size="lg" className="mt-4 w-full" onClick={() => { setEstado("cargando"); void cargar(); }}>Intentar de nuevo</Button>
      </div>
    ) : <Cargando />;
  } else if (estado === "membresia" || estado === "sin_pin") {
    contenido = <PasoBloqueo motivo={estado === "membresia" ? "membresia" : "sin_pin"} negocio={negocio} rol={rol} />;
  } else if (fuera && rol === "empleado") {
    const hoy = horarioHoy(config?.horarios, ctx.zona);
    contenido = <div className="mx-auto max-w-md rounded-2xl bg-card p-6 ring-1 ring-border">
      <h1 className="text-2xl font-semibold">Fuera de horario</h1>
      <p className="mt-2 text-muted-foreground">La caja solo opera en el horario que fijó el dueño.</p>
      {hoy && <p className="mt-3 font-medium">{hoy}</p>}
      <Button size="lg" className="mt-5 w-full" disabled={revisando} onClick={() => void revisar()}>Volver a revisar</Button>
    </div>;
  } else if (estado === "cerrada") {
    contenido = <PasoAbrir negocio={negocio} onAbierta={(v) => { setVenceEn(v); setEstado("abierta"); toast.success("Caja abierta"); }} />;
  } else {
    const volverFicha = () => setPaso("ficha");
    contenido = (
      <>
        <FranjaCaja venceEn={venceEn} zona={ctx.zona} gracia={config?.negocio.membresia_estado === "gracia"}
          onCerrada={() => { setVenceEn(null); nuevoCliente(); setEstado("cerrada"); }} />
        {paso === "buscar" && <PasoBuscar inicial={telefono} onEncontrado={(t, c) => { setTelefono(t); setFicha(c); setPaso("ficha"); }} onAlta={(t) => { setTelefono(t); setPaso("alta"); }} />}
        {paso === "alta" && <PasoAlta telefono={telefono} onVolver={() => setPaso("buscar")} onHecha={(r) => void altaHecha(r)} />}
        {paso === "ficha" && ficha && <PasoFicha ficha={ficha} onVolver={nuevoCliente} onAccion={(a) => setPaso(a)} onRefrescar={async () => {
          const r = await ejecutar(() => buscarCliente(telefonoE164(telefono)));
          if (r.encontrado) setFicha(r); else nuevoCliente();
        }} />}
        {paso === "acumular" && ficha && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><ResumenCliente ficha={ficha} /><PasoAcumular telefono={telefono} ficha={ficha} onVolver={volverFicha} onHecho={terminado} /></div>}
        {paso === "canjear" && ficha && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><ResumenCliente ficha={ficha} /><PasoCanjear telefono={telefono} ficha={ficha} onVolver={volverFicha} onHecho={terminado} /></div>}
        {paso === "reclamar" && ficha && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><ResumenCliente ficha={ficha} /><PasoReclamar telefono={telefono} ficha={ficha} onVolver={volverFicha} onHecho={terminado} /></div>}
        {paso === "comprobante" && comprobante && (
          <PasoComprobante comprobante={comprobante} nombre={ficha ? ficha.cliente.nombre : null} onNuevo={nuevoCliente}
            onSeguir={() => { setComprobante(null); setPaso("ficha"); }} />
        )}
        {paso === "ficha" && !ficha && <Cargando />}
      </>
    );
  }

  return (
    <AppShell amplio>
      {ctx ? <CajaProvider valor={ctx}>{contenido}</CajaProvider> : contenido}
      <Dialog open={!!pidePin} onOpenChange={(o) => { if (!o && pidePin) { pidePin.cancelar(); setPidePin(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">La caja se cerró</DialogTitle>
            <DialogDescription className="text-base">
              Escribe el PIN POS para abrirla. La operación{ficha ? ` de ${nombreCliente(ficha.cliente)}` : ""} se repetirá sin cobrar dos veces.
            </DialogDescription>
          </DialogHeader>
          <PinPos compacto onAbierta={(v) => {
            setVenceEn(v);
            const p = pidePin;
            setPidePin(null);
            p?.reintentar();
          }} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
