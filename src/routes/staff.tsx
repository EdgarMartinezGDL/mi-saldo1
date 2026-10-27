import { createFileRoute } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/client";
import { fechaCorta, instante, nombreCompleto, pesos, telefonoVisible } from "@/lib/api/formato";
import {
  buscarPersonas,
  fichaPersona,
  negociosStaff,
  reactivarNegocio,
  rectificarDatos,
  resumenStaff,
  suspenderNegocio,
  type CambiosPersona,
  type EstadoMembresia,
  type FichaPersona,
  type NegocioStaff,
  type Persona,
  type ResumenStaff,
} from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { DetalleNegocio, lineaAviso } from "@/components/staff/detalle-negocio";
import { AjusteStaff } from "@/components/staff/ajuste-staff";
import { StaffNav, useNivelStaff, type FiltroAuditoria } from "@/components/staff/comun";
import { PestanaAlertas } from "@/components/staff/alertas";
import { PestanaAuditoria } from "@/components/staff/auditoria";
import { PestanaNotificaciones } from "@/components/staff/notificaciones";
import { PestanaEquipo } from "@/components/staff/equipo";
import { AccionesPersona, DatosFicha } from "@/components/staff/ficha-acciones";
import { NuevoNegocio } from "@/components/staff/nuevo-negocio";
import { PestanaWhatsapp } from "@/components/staff/portafolios";
import { TarjetaPrecioMembresia } from "@/components/staff/precio-membresia";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus } from "lucide-react";
import { plural } from "@/lib/plural";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff MiSaldo · Soporte" },
      { name: "description", content: "Búsqueda global de negocios y personas, rectificación de datos y suspensión de negocios." },
      { property: "og:title", content: "Staff MiSaldo · Soporte" },
      { property: "og:description", content: "Panel de soporte de MiSaldo para negocios y personas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Staff MiSaldo" roles={["staff"]}>
      <Staff />
    </RequiereSesion>
  ),
});

const ESTADOS: Record<EstadoMembresia, { l: string; c: string }> = {
  prueba: { l: "Prueba", c: "bg-secondary text-foreground" },
  activa: { l: "Activa", c: "bg-primary/15 text-primary" },
  gracia: { l: "Gracia", c: "bg-warn/15 text-warn" },
  vencida: { l: "Vencida", c: "bg-destructive/10 text-destructive" },
  suspendida: { l: "Suspendida", c: "bg-destructive text-destructive-foreground" },
};
const error = (e: unknown) => {
  const err = e instanceof ApiError ? e : null;
  toast.error(err?.message ?? "Algo salió mal. Intenta de nuevo.");
};
function Staff() {
  type Tab = "negocios" | "personas" | "whatsapp" | "alertas" | "notificaciones" | "auditoria" | "equipo";
  const [tab, setTab] = useState<Tab>("negocios");
  const { esAdmin } = useNivelStaff();
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [filtroAud, setFiltroAud] = useState<FiltroAuditoria | null>(null);
  const nav = {
    irA: (t: string) => setTab(t as Tab),
    verFicha: (id: string) => { setFichaId(id); setTab("personas"); },
    verAuditoria: (f: FiltroAuditoria) => { setFiltroAud(f); setTab("auditoria"); },
  };
  const TABS: [Tab, string][] = [
    ["negocios", "Negocios"], ["personas", "Personas"], ["whatsapp", "WhatsApp"], ["alertas", "Alertas"], ["notificaciones", "Notificaciones"],
    ...(esAdmin ? [["auditoria", "Auditoría"] as [Tab, string]] : []), ["equipo", "Equipo"],
  ];
  const qc = useQueryClient();
  const [resumen, setResumen] = useState<ResumenStaff | null>(null);
  const cargarResumen = () => {
    resumenStaff().then(setResumen).catch(error);
    void qc.invalidateQueries({ queryKey: ["portafolios"] });
  };
  useEffect(cargarResumen, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Staff MiSaldo</h1>
          <p className="mt-1 text-base text-muted-foreground">Soporte a negocios y personas.</p>
        </div>
        {resumen && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Negocios", v: resumen.negocios.total },
              { l: "Vencen en 7 días", v: resumen.negocios.vencen_7_dias },
              { l: "Sin pago", v: resumen.negocios.sin_pago },
              { l: "Alertas pendientes", v: resumen.alertas_pendientes },
            ].map((c) => (
              <button type="button" key={c.l} onClick={c.l === "Alertas pendientes" ? () => setTab("alertas") : undefined}
                className={cn("rounded-2xl bg-card p-4 text-left ring-1 ring-border", c.l !== "Alertas pendientes" && "cursor-default")}>
                <p className="font-mono text-2xl font-bold tabular-nums">{c.v}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.l}</p>
              </button>
            ))}
            <button type="button" onClick={() => setTab("whatsapp")}
              className={cn("col-span-2 rounded-2xl p-4 text-left ring-1 lg:col-span-4",
                resumen.whatsapp.alerta_capacidad ? "bg-destructive/10 ring-destructive/50" : "bg-card ring-border")}>
              <p className="flex items-center gap-2 text-base font-semibold"><MessageCircle className="size-5 text-primary" /> WhatsApp</p>
              <p className="mt-1 text-sm">{resumen.whatsapp.lugares_libres} lugares libres · {resumen.whatsapp.negocios_sin_whatsapp} negocios sin número</p>
              {resumen.whatsapp.alerta_capacidad && <p className="mt-1 text-sm font-medium text-destructive">Quedan pocos lugares: da de alta otro portafolio</p>}
            </button>
          </div>
        )}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map(([t, etiqueta]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "tap-target shrink-0 rounded-full px-5 text-sm font-semibold ring-1",
                tab === t ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-muted-foreground",
              )}
            >
              {etiqueta}
              {t === "alertas" && (resumen?.alertas_pendientes ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{resumen!.alertas_pendientes}</span>
              )}
            </button>
          ))}
        </div>
        <StaffNav.Provider value={nav}>
          {tab === "negocios" && <Negocios onCambio={cargarResumen} onIrWhatsapp={() => setTab("whatsapp")} />}
          {tab === "personas" && <Personas abrirId={fichaId} onAbierta={() => setFichaId(null)} />}
          {tab === "whatsapp" && <PestanaWhatsapp />}
          {tab === "alertas" && <PestanaAlertas onCambio={cargarResumen} />}
          {tab === "notificaciones" && <PestanaNotificaciones />}
          {tab === "auditoria" && esAdmin && <PestanaAuditoria inicial={filtroAud} />}
          {tab === "equipo" && <PestanaEquipo />}
        </StaffNav.Provider>
      </div>
    </AppShell>
  );
}

function Negocios({ onCambio, onIrWhatsapp }: { onCambio: () => void; onIrWhatsapp: () => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const { esAdmin } = useNivelStaff();
  const [nuevo, setNuevo] = useState(false);
  const conTotp = useConTotp();
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<NegocioStaff[] | null>(null);

  const cargar = async () => {
    const t = q.trim();
    const dig = t.replace(/[\s+-]/g, "");
    const busqueda = /^\d+$/.test(dig) ? (dig.length >= 4 ? dig : undefined) : t.length >= 2 ? t : undefined;
    try {
      setLista((await negociosStaff({ busqueda })).negocios);
    } catch (e) {
      error(e);
    }
  };
  useEffect(() => {
    const id = setTimeout(() => void cargar(), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const [accion, setAccion] = useState<{ n: NegocioStaff; tipo: "suspender" | "reactivar" } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const abrirAccion = (n: NegocioStaff, tipo: "suspender" | "reactivar") => { setMotivo(""); setAccion({ n, tipo }); };
  const ejecutar = async () => {
    if (!accion) return;
    const { n, tipo } = accion;
    const m = motivo.trim();
    setEnviando(true);
    try {
      if (tipo === "suspender") {
        const r = await conTotp(() => suspenderNegocio(n.negocio_id, m));
        toast.success("Negocio suspendido", { description: `${plural(r.sesiones_revocadas, "sesión cerrada", "sesiones cerradas")}.` });
      } else {
        await conTotp(() => reactivarNegocio(n.negocio_id, m));
        toast.success("Negocio reactivado");
      }
      setAccion(null);
      await cargar();
    } catch (e) {
      error(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {esAdmin && (
        <Button className="self-start" onClick={() => setNuevo(true)}><Plus className="size-4" /> Nuevo negocio</Button>
      )}
      <NuevoNegocio abierto={nuevo} onAbierto={setNuevo} onIrWhatsapp={() => { setNuevo(false); onIrWhatsapp(); }}
        onCreado={() => { void cargar(); onCambio(); }} />
      <TarjetaPrecioMembresia />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre del negocio o teléfono del dueño..."
          aria-label="Buscar negocio"
          className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
        />
      </label>
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        {!lista ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay negocios que coincidan.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lista.map((n) => (
              <li key={n.negocio_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <button type="button" onClick={() => setAbierto(n.negocio_id)} className="min-w-0 flex-1 text-left">
                  <p className="flex items-center gap-2 truncate text-base font-medium">
                    {n.nombre_comercial}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[n.membresia.estado].c)}>
                      {ESTADOS[n.membresia.estado].l}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nombreCompleto(n.dueno)} · {telefonoVisible(n.dueno.telefono)} · {lineaAviso(n.membresia) ?? `vence ${fechaCorta(n.membresia.fecha_vencimiento)}`}
                  </p>
                </button>
                {!esAdmin ? null : n.membresia.estado === "suspendida" ? (
                  <Button size="sm" variant="secondary" onClick={() => abrirAccion(n, "reactivar")}>
                    Reactivar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => abrirAccion(n, "suspender")}>
                    Suspender
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <AlertDialog open={!!accion} onOpenChange={(o) => { if (!o && !enviando) setAccion(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{accion?.tipo === "suspender" ? `¿Suspender ${accion.n.nombre_comercial}?` : `¿Reactivar ${accion?.n.nombre_comercial ?? ""}?`}</AlertDialogTitle>
            {accion?.tipo === "suspender" && <AlertDialogDescription>Se cierran al instante todas sus sesiones y cajas.</AlertDialogDescription>}
          </AlertDialogHeader>
          <label className="grid gap-2 text-sm font-medium">Motivo (canal y folio)
            <Textarea value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Solicitud por WhatsApp, folio WA-000456" />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <Button disabled={enviando || motivo.trim().length < 5} variant={accion?.tipo === "suspender" ? "destructive" : "default"} onClick={() => void ejecutar()}>
              {accion?.tipo === "suspender" ? "Sí, suspender" : "Sí, reactivar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DetalleNegocio
        negocioId={abierto}
        estados={ESTADOS}
        onCerrar={() => setAbierto(null)}
        onCambio={() => {
          void cargar();
          onCambio();
        }}
      />
    </>
  );
}

function Personas({ abrirId, onAbierta }: { abrirId: string | null; onAbierta: () => void }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Persona[] | null>(null);
  const [ficha, setFicha] = useState<FichaPersona | null>(null);
  const refFicha = useDesplazarAlAbrir<HTMLDivElement>(ficha?.persona_id ?? null);

  const buscar = async () => {
    let t = q.trim();
    const dig = t.replace(/\D/g, "");
    if (!t.includes("@") && !t.startsWith("+") && dig.length === 10) t = `+52${dig}`;
    try {
      setLista(await buscarPersonas(t));
    } catch (e) {
      error(e);
    }
  };
  const abrir = async (id: string) => {
    try {
      setFicha(await fichaPersona(id));
    } catch (e) {
      error(e);
    }
  };
  useEffect(() => {
    if (abrirId) { void abrir(abrirId); onAbierta(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

  return (
    <>
      <div className="flex gap-2">
        <Input
          className="h-12 text-base"
          placeholder="Teléfono exacto (10 dígitos o +lada) o correo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q.trim() && void buscar()}
        />
        <Button className="h-12 shrink-0" disabled={!q.trim()} onClick={() => void buscar()}>
          <Search className="size-5" /> Buscar
        </Button>
      </div>
      {ficha && (
        <div ref={refFicha}>
          <Ficha ficha={ficha} onCerrar={() => setFicha(null)} onActualizada={() => void abrir(ficha.persona_id)} />
        </div>
      )}
      {lista && (
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie con ese teléfono o correo.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lista.map((p) => (
                <li key={p.persona_id}>
                  <button type="button" onClick={() => void abrir(p.persona_id)} className="w-full py-3 text-left">
                    <p className="text-base font-medium">{nombreCompleto(p)}</p>
                    <p className="text-sm text-muted-foreground">
                      {telefonoVisible(p.telefono)} · {p.correo ?? "sin correo"} · cliente en {plural(p.roles.cliente, "negocio", "negocios")}
                      {p.roles.dueno.length > 0 && ` · dueño de ${p.roles.dueno.map((d) => d.nombre_comercial).join(", ")}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

type DatosArco = { nombre: string; ap: string; am: string; dia: string; mes: string };

function Ficha({ ficha, onCerrar, onActualizada }: { ficha: FichaPersona; onCerrar: () => void; onActualizada: () => void }) {
  const conTotp = useConTotp();
  const { esAdmin } = useNivelStaff();
  const [ajustar, setAjustar] = useState<string | null>(null);
  const arcoGuardado: DatosArco = {
    nombre: ficha.nombre,
    ap: ficha.apellido_paterno ?? "",
    am: ficha.apellido_materno ?? "",
    dia: ficha.nacimiento_dia ? String(ficha.nacimiento_dia) : "",
    mes: ficha.nacimiento_mes ? String(ficha.nacimiento_mes) : "",
  };
  const arco = useModoEdicion<DatosArco>(arcoGuardado);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cambios: CambiosPersona = {};
  if (arco.valores.nombre.trim() !== ficha.nombre) cambios.nombre = arco.valores.nombre.trim();
  if ((arco.valores.ap.trim() || null) !== ficha.apellido_paterno) cambios.apellido_paterno = arco.valores.ap.trim() || null;
  if ((arco.valores.am.trim() || null) !== ficha.apellido_materno) cambios.apellido_materno = arco.valores.am.trim() || null;
  const d = arco.valores.dia ? Number(arco.valores.dia) : null;
  const m = arco.valores.mes ? Number(arco.valores.mes) : null;
  if (d !== ficha.nacimiento_dia || m !== ficha.nacimiento_mes) {
    cambios.nacimiento_dia = d;
    cambios.nacimiento_mes = m;
  }
  const hayCambios = Object.keys(cambios).length > 0;
  const motivoOk = motivo.trim().length >= 5;

  const guardar = async () => {
    setOcupado(true);
    try {
      const r = await conTotp(() => rectificarDatos(ficha.persona_id, cambios, motivo.trim()));
      toast.success("Datos rectificados", { description: `${plural(r.cambios.length, "campo corregido", "campos corregidos")}. La persona recibe un aviso.` });
      setMotivo("");
      arco.terminar();
      onActualizada();
    } catch (e) {
      error(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{ficha.eliminada ? "Persona eliminada" : nombreCompleto(ficha)}</p>
          <p className="text-sm text-muted-foreground">
            {telefonoVisible(ficha.telefono)} · {ficha.correo ?? "sin correo"} · {ficha.tiene_2fa ? "con 2FA" : "sin 2FA"}
          </p>
        </div>
        <button type="button" aria-label="Cerrar ficha" onClick={onCerrar} className="tap-target grid place-items-center text-muted-foreground">
          <X className="size-5" />
        </button>
      </div>
      {!ficha.eliminada && <DatosFicha f={ficha} />}
      {ficha.clientes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {ficha.clientes.map((c) => (
            <li key={c.negocio_cliente_id} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-medium">{c.negocio.nombre_comercial}</span>
                {esAdmin && !ficha.eliminada && (
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setAjustar(c.negocio.negocio_id)}>Ajustar</Button>
                )}
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[c.negocio.membresia].c)}>
                  {c.negocio.membresia === "gracia" ? "Pago pendiente" : ESTADOS[c.negocio.membresia].l}
                </span>
              </div>
              <p className="text-sm">
                {c.monedero ? (
                  <>
                    <span className="font-mono font-semibold">{pesos(c.monedero.saldo_centavos)}</span>
                    {c.monedero.fecha_vencimiento && <span className="text-muted-foreground"> · vence el {fechaCorta(c.monedero.fecha_vencimiento)}</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">Sin saldo</span>
                )}
              </p>
              {(c.tarjetas ?? []).map((t, i) => (
                <div key={`${t.tarjeta_digital_id}-${t.estado}-${i}`} className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {t.tarjeta} · <span className="font-mono">{t.sellos_actuales}/{t.sellos_requeridos}</span>
                      {t.fecha_vencimiento && <span className="text-muted-foreground"> · vence el {fechaCorta(t.fecha_vencimiento)}</span>}
                    </span>
                    {t.estado === "completa" && <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">Premio listo</span>}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (t.sellos_actuales / Math.max(1, t.sellos_requeridos)) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Cliente desde {fechaCorta(c.cliente_desde)} · Última compra: {c.ultima_compra_en ? instante(c.ultima_compra_en) : "sin compras"}
                {c.acepta_promociones === false && " · No acepta promociones"}
              </p>
              {c.reclamaciones_pendientes > 0 && (
                <p className="text-xs font-medium text-warn">
                  {c.reclamaciones_pendientes} {c.reclamaciones_pendientes === 1 ? "reclamación pendiente" : "reclamaciones pendientes"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <AjusteStaff negocioId={ajustar} personaId={ficha.persona_id} onCerrar={() => { setAjustar(null); onActualizada(); }} />
      {esAdmin && !ficha.eliminada && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-base font-semibold">Rectificar datos (ARCO)</h3>
          {!arco.editando ? (
            <div className="mt-3">
              <VistaLectura
                datos={[
                  { etiqueta: "Nombre", valor: arco.guardado.nombre },
                  { etiqueta: "Apellido paterno", valor: arco.guardado.ap },
                  { etiqueta: "Apellido materno", valor: arco.guardado.am },
                  { etiqueta: "Día de nacimiento", valor: arco.guardado.dia },
                  { etiqueta: "Mes de nacimiento", valor: arco.guardado.mes },
                ]}
                onEditar={() => { setMotivo(""); arco.editar(); }}
              />
            </div>
          ) : (
            <div ref={arco.ref} className="mt-3 flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-nom">Nombre</Label>
                  <Input id="r-nom" className="h-11" value={arco.valores.nombre} onChange={(e) => arco.set("nombre", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-ap">Apellido paterno</Label>
                  <Input id="r-ap" className="h-11" value={arco.valores.ap} onChange={(e) => arco.set("ap", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-am">Apellido materno</Label>
                  <Input id="r-am" className="h-11" value={arco.valores.am} onChange={(e) => arco.set("am", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-dia">Día de nacimiento</Label>
                  <Input id="r-dia" inputMode="numeric" className="h-11" value={arco.valores.dia} onChange={(e) => arco.set("dia", e.target.value.replace(/\D/g, "").slice(0, 2))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-mes">Mes de nacimiento</Label>
                  <Input id="r-mes" inputMode="numeric" className="h-11" value={arco.valores.mes} onChange={(e) => arco.set("mes", e.target.value.replace(/\D/g, "").slice(0, 2))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-mot">Motivo (canal y folio)</Label>
                <Input id="r-mot" className="h-11" value={motivo} maxLength={500} placeholder="Solicitud ARCO por WhatsApp, folio WA-000456" onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <BotonesEdicion
                textoGuardar="Guardar rectificación"
                ocupado={ocupado}
                cambiado={hayCambios && motivoOk}
                onGuardar={() => void guardar()}
                onCancelar={() => { arco.cancelar(); setMotivo(""); }}
              />
            </div>
          )}
        </div>
      )}
      {esAdmin && !ficha.eliminada && <AccionesPersona f={ficha} onCambio={onActualizada} />}
    </section>
  );
}
