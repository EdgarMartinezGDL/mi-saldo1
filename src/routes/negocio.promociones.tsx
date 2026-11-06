import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Megaphone, Send, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useDigitos, useTecla } from "@/components/caja/teclado";
import { CasillasDigitos } from "@/components/casillas-digitos";
import { useError } from "@/components/cuenta/secciones";
import { EstadoVacio } from "@/components/estado-vacio";
import { IconoTono } from "@/components/fila-lista";
import { SeccionNegocio } from "@/components/negocio/comun";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { instante } from "@/lib/api/formato";
import {
  enviarPromocion,
  historialPromociones,
  resumenPromociones,
  type ResumenPromociones,
} from "@/lib/api/push";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/negocio/promociones")({
  head: () => ({
    meta: [
      { title: "Promociones · Mi Saldo Vip" },
      { name: "description", content: "Envía avisos al celular de los clientes que activaron las notificaciones." },
      { property: "og:title", content: "Promociones · Mi Saldo Vip" },
      { property: "og:description", content: "Envía avisos al celular de los clientes que activaron las notificaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Promociones" descripcion="Envía un aviso a los clientes que activaron las notificaciones.">
      <PromocionesNegocio />
    </SeccionNegocio>
  ),
});

const DESTINOS = [
  { ruta: "/", nombre: "Inicio" },
  { ruta: "/canjear", nombre: "Mis recompensas" },
  { ruta: "/referidos", nombre: "Recomienda y gana" },
] as const;
const nombreDestino = (ruta: string) => DESTINOS.find((d) => d.ruta === ruta)?.nombre ?? "Inicio";

export function PromocionesNegocio() {
  const { sesion } = useAuth();
  const negocio = sesion?.contexto.nombre_comercial ?? "Tu negocio";
  const resumen = useQuery({ queryKey: ["promociones-resumen"], queryFn: resumenPromociones });
  if (resumen.error) return <p className="rounded-xl bg-destructive/10 p-4 text-destructive">{resumen.error.message}</p>;
  if (!resumen.data) return <Cargando forma="tarjetas" />;
  return (
    <>
      <Resumen r={resumen.data} />
      <Formulario r={resumen.data} negocio={negocio} />
      <Historial />
    </>
  );
}

function Resumen({ r }: { r: ResumenPromociones }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <IconoTono icono={BellRing} tono="primary" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo recibirían</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{r.destinatarios}</p>
            <p className="text-sm text-muted-foreground">dispositivos</p>
            <p className="text-xs text-muted-foreground">de {r.clientes_con_push} clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <IconoTono icono={Send} tono={r.puede_enviar ? "success" : "warning"} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disponible</p>
            <p className="text-base font-semibold">
              {r.puede_enviar ? "Hoy puedes enviar 1" : `Desde el ${r.disponible_desde ? instante(r.disponible_desde) : "…"}`}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Límite: {r.limite.por_dia} promoción al día y {r.limite.por_semana} por semana. Solo llega a clientes con notificaciones y promociones activadas.
      </p>
      {!r.totp_activo && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-warning/15 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-warning-icono" />
          <p>
            Para enviar promociones necesitas la verificación en dos pasos (app autenticadora).{" "}
            <Link to="/ajustes" className="font-medium text-primary underline">Activarla en Cuenta</Link>
          </p>
        </div>
      )}
      {r.destinatarios === 0 && (
        <EstadoVacio
          icono={BellRing}
          titulo="Aún ningún cliente activó las notificaciones"
          texto="Pídeles que entren a Cuenta en su app y toquen Activar notificaciones."
        />
      )}
    </section>
  );
}

function Formulario({ r, negocio }: { r: ResumenPromociones; negocio: string }) {
  const queryClient = useQueryClient();
  const mostrar = useError();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [ruta, setRuta] = useState<string>("/");
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const refDialogo = useRef<HTMLDivElement>(null);

  const tituloValido = titulo.trim().length >= 3 && titulo.length <= 50;
  const cuerpoValido = cuerpo.trim().length >= 5 && cuerpo.length <= 150;
  const puedeEnviar = tituloValido && cuerpoValido && r.totp_activo && r.puede_enviar && r.destinatarios > 0;

  const onKey = (k: string) => {
    if (enviando) return;
    setErrorCodigo(null);
    if (k === "borrar") setCodigo((c) => c.slice(0, -1));
    else if (k === "limpiar") setCodigo("");
    else setCodigo((c) => (c.length < 6 ? c + k : c));
  };
  useDigitos(onKey, { activo: abierto && !enviando, ref: refDialogo });
  useTecla(
    (e) => {
      if (e.key === "Enter" && codigo.length === 6) {
        void confirmar();
        return true;
      }
      return false;
    },
    { activo: abierto && !enviando, ref: refDialogo },
  );

  const confirmar = async () => {
    if (enviando || codigo.length !== 6) return;
    setEnviando(true);
    try {
      const res = await enviarPromocion({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), ruta, codigo });
      setAbierto(false);
      setTitulo("");
      setCuerpo("");
      setRuta("/");
      setCodigo("");
      toast.success(`Promoción enviada a ${res.destinatarios} dispositivos`);
      void queryClient.invalidateQueries({ queryKey: ["promociones-resumen"] });
      void queryClient.invalidateQueries({ queryKey: ["promociones-historial"] });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 422 && err.codigo === "codigo_incorrecto") {
        setCodigo("");
        const n = err.extras["intentos_restantes"];
        setErrorCodigo(`${err.message}${typeof n === "number" ? ` Te quedan ${n} intentos.` : ""}`);
      } else {
        setAbierto(false);
        setCodigo("");
        if (err?.status === 429 && err.codigo === "limite") {
          const d = err.extras["disponible_desde"];
          toast.error(`Ya enviaste el máximo de promociones. Podrás enviar otra el ${typeof d === "string" ? instante(d) : "siguiente día disponible"}.`);
        } else {
          mostrar(e);
        }
      }
    } finally {
      setEnviando(false);
    }
  };

  const contador = (n: number, max: number) => (
    <span className={cn("text-xs tabular-nums", n > max ? "text-destructive" : "text-muted-foreground")}>{n}/{max}</span>
  );

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Nueva promoción</h2>
      <fieldset disabled={!r.totp_activo} className="mt-4 flex flex-col gap-4 disabled:opacity-60">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="promo-titulo" className="text-base">Título</Label>
            {contador(titulo.length, 50)}
          </div>
          <Input id="promo-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} className="h-12 text-base" placeholder="Dos por uno hoy" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="promo-mensaje" className="text-base">Mensaje</Label>
            {contador(cuerpo.length, 150)}
          </div>
          <Textarea id="promo-mensaje" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={3} maxLength={170} className="text-base" placeholder="Solo hoy: dos por uno en toda la carta." />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="promo-destino" className="text-base">A dónde lleva</Label>
          <select id="promo-destino" value={ruta} onChange={(e) => setRuta(e.target.value)} className="h-12 rounded-xl border border-border bg-card px-3 text-base shadow-soft">
            {DESTINOS.map((d) => <option key={d.ruta} value={d.ruta}>{d.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Así se verá</span>
          <div className="rounded-2xl bg-card p-4 shadow-raised ring-1 ring-border">
            <div className="flex items-start gap-3">
              <img src="/icons/icon-512.png" alt="" width={40} height={40} decoding="async" className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mi Saldo Vip · ahora</p>
                <p className={cn("font-semibold", !titulo && "text-muted-foreground")}>{negocio}: {titulo || "Título de la promoción"}</p>
                <p className={cn("line-clamp-3 text-sm", !cuerpo && "text-muted-foreground")}>{cuerpo || "El mensaje que recibirán tus clientes."}</p>
              </div>
            </div>
          </div>
        </div>
        <Button size="lg" className="h-14 w-full text-base" disabled={!puedeEnviar} onClick={() => { setCodigo(""); setErrorCodigo(null); setAbierto(true); }}>
          <Send className="size-5" /> Enviar promoción
        </Button>
      </fieldset>

      <Dialog open={abierto} onOpenChange={(o) => { if (!enviando) { setAbierto(o); if (!o) { setCodigo(""); setErrorCodigo(null); } } }}>
        <DialogContent
          onEscapeKeyDown={(e) => enviando && e.preventDefault()}
          onPointerDownOutside={(e) => enviando && e.preventDefault()}
        >
          <div ref={refDialogo} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Confirma con tu app autenticadora</DialogTitle>
              <DialogDescription>
                Se enviará a {r.destinatarios} dispositivos. Escribe el código de 6 dígitos de tu app.
              </DialogDescription>
            </DialogHeader>
            <CasillasDigitos largo={6} llenos={codigo.length} activo={!enviando} grande />
            {errorCodigo && <p className="text-sm text-destructive">{errorCodigo}</p>}
            <NumericKeypad compacto onKey={onKey} />
            <DialogFooter>
              <Button variant="outline" disabled={enviando} onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button variant="primario" disabled={enviando || codigo.length !== 6} onClick={() => void confirmar()}>
                {enviando ? "Enviando…" : "Enviar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Historial() {
  const q = useQuery({
    queryKey: ["promociones-historial"],
    queryFn: historialPromociones,
    refetchInterval: (consulta) =>
      consulta.state.data?.promociones.some((p) => p.estado === "enviando") ? 5000 : false,
  });
  const promos = q.data?.promociones;
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Enviadas</h2>
      {q.isLoading ? (
        <Cargando />
      ) : q.error ? (
        <p className="mt-4 text-destructive">{q.error.message}</p>
      ) : !promos || promos.length === 0 ? (
        <EstadoVacio icono={Megaphone} titulo="Aún no envías promociones." />
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-separador">
          {promos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <IconoTono icono={Megaphone} tono="accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.titulo}</p>
                <p className="text-sm text-muted-foreground">{instante(p.creado_en)} · {nombreDestino(p.ruta)}</p>
                {p.fallidos > 0 && <p className="text-xs text-muted-foreground">{p.fallidos} no llegaron</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums"><strong>{p.enviados}</strong> de {p.destinatarios}</p>
                <span className={cn("pill-badge", p.estado === "enviando" ? "text-primary" : "text-success")}>
                  {p.estado === "enviando" ? "Enviando" : "Enviada"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
