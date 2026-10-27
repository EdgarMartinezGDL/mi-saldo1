import { useAsistente } from "@/components/negocio/asistente";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, ListChecks, Clock, Gift, ChevronRight, CreditCard, History, KeyRound, MessageSquareWarning, Palette, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useConfigNegocio } from "@/components/negocio/comun";
import { useConteosNegocio } from "@/components/negocio/operacion-ui";
import { RequiereSesion } from "@/components/requiere-sesion";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/negocio/")({
  head: () => ({
    meta: [
      { title: "Mi negocio · MiSaldo" },
      { name: "description", content: "Centro de administración: marca, monedero, PIN POS, empleados y membresía." },
      { property: "og:title", content: "Mi negocio · MiSaldo" },
      { property: "og:description", content: "Administra la marca, el cashback, el PIN POS, tus empleados y tu membresía." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Mi negocio" roles={["dueno"]}>
      <Centro />
    </RequiereSesion>
  ),
});

type Tarjeta = { to: string; titulo: string; texto: string; icono: LucideIcon; alerta?: string };

export function Centro() {
  const { data: estadoAsistente } = useAsistente();
  const { data } = useConfigNegocio();
  const sinPin = data ? !data.negocio.pin_pos_configurado : false;
  const { data: conteos } = useConteosNegocio();
  const rec = conteos?.reclamaciones ?? 0;
  const sol = conteos?.solicitudes ?? 0;
  const tarjetas: Tarjeta[] = [
    { to: "/negocio/marca", titulo: "Datos y marca", texto: "Nombre, logotipo y color de tu negocio.", icono: Palette },
    { to: "/negocio/movimientos", titulo: "Movimientos", texto: "Todo lo que pasó en tu caja, con filtros y Excel.", icono: History },
    {
      to: "/negocio/reclamaciones",
      titulo: "Reclamaciones",
      texto: "Compras que no se registraron.",
      icono: MessageSquareWarning,
      ...(rec > 0 ? { alerta: `${rec} ${rec === 1 ? "pendiente" : "pendientes"}` } : {}),
    },
    {
      to: "/negocio/solicitudes",
      titulo: "Solicitudes de alta",
      texto: "Altas que esperan la confirmación del titular.",
      icono: UserPlus,
      ...(sol > 0 ? { alerta: `${sol} ${sol === 1 ? "pendiente" : "pendientes"}` } : {}),
    },
    { to: "/negocio/monedero", titulo: "Monedero y tarjetas de sellos", texto: "Cashback, vigencia del saldo y tus tarjetas.", icono: Wallet },
    {
      to: "/negocio/pin-pos",
      titulo: "PIN POS",
      texto: "El PIN con el que se abre la caja.",
      icono: KeyRound,
      ...(sinPin ? { alerta: "Aún no lo defines: nadie puede abrir la caja." } : {}),
    },
    { to: "/negocio/horarios", titulo: "Horarios", texto: "Los días y horas en que abres.", icono: Clock },
    { to: "/negocio/referidos", titulo: "Recomienda y gana", texto: "Premia a tus clientes por traer clientes nuevos.", icono: Gift },
    { to: "/negocio/reportes", titulo: "Reportes", texto: "Cumpleañeros e inactivos en Excel, con enlace de WhatsApp.", icono: BarChart3 },
    { to: "/empleados", titulo: "Empleados", texto: "Da de alta, invita o da de baja a tus cajeros.", icono: Users },
    { to: "/negocio/membresia", titulo: "Membresía y pagos", texto: "Estado de tu membresía y cómo pagarla.", icono: CreditCard },
  ];

  if (estadoAsistente && !estadoAsistente.configuracion_completa) {
    const n = estadoAsistente.pendientes_obligatorios.length;
    tarjetas.unshift({ to: "/negocio/asistente", titulo: "Configuración inicial", texto: "Termina de configurar tu negocio para empezar a cobrar.", alerta: `${n === 1 ? "Te falta" : "Te faltan"} ${plural(n, "paso obligatorio", "pasos obligatorios")}.`, icono: ListChecks });
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mi negocio</h1>
          <p className="mt-1 text-base text-muted-foreground">Elige qué quieres administrar.</p>
        </div>
        <div className="flex flex-col gap-3">
          {tarjetas.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="tap-target flex min-h-20 items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border transition-colors hover:text-primary"
            >
              <span className="shadow-soft grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <t.icono className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{t.titulo}</span>
                <span className="block text-sm text-muted-foreground">{t.texto}</span>
                {t.alerta && <span className="mt-1 block text-sm font-medium text-destructive">{t.alerta}</span>}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
