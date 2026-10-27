import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { asistente, type Asistente, type EstadoModuloAsistente, type PasoAsistente } from "@/lib/api/dueno";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PASOS_ASISTENTE = {
  datos: { titulo: "Datos y marca", to: "/negocio/marca", texto: "Nombre, giro, logotipo y color de tu negocio. Si aún no tienes logo, puedes seguir." },
  horarios: { titulo: "Horarios", to: "/negocio/horarios", texto: "Los días y horas en que abres. Tus cajeros solo cobran en ese horario." },
  modulos: { titulo: "Monedero y tarjetas", to: "/negocio/monedero", texto: "" },
  pin_pos: { titulo: "PIN POS", to: "/negocio/pin-pos", texto: "El PIN de 6 dígitos con el que tus cajeros abren la caja." },
  empleados: { titulo: "Empleados", to: "/empleados", texto: "Invita a tus cajeros. Si atiendes tú solo, omite este paso." },
  referidos: { titulo: "Recomienda y gana", to: "/negocio/referidos", texto: "Premia a tus clientes por traer clientes nuevos." },
} as const;

export const pasosVisibles = (datos: Asistente) => datos.pasos.filter((p) => p.paso !== "referidos" || p.disponible);
export const validarBusquedaAsistente = (search: Record<string, unknown>): { asistente?: 1 } =>
  search["asistente"] === "1" || search["asistente"] === 1 ? { asistente: 1 } : {};

export function useAsistente() {
  return useQuery({ queryKey: ["asistente"], queryFn: async () => {
    const respuesta = await asistente();
    if (!Array.isArray(respuesta.pasos)) throw new Error("No se pudo cargar la configuración inicial.");
    return respuesta;
  }, retry: false });
}

export function useInvalidarAsistente() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ["asistente"] }); };
}

const MONEDERO: Record<EstadoModuloAsistente, string> = {
  configurado: "Cashback listo", pendiente: "Falta la tasa de cashback (usa la calculadora)", en_retiro: "Monedero en retiro", no_contratado: "",
};
const TARJETAS: Record<EstadoModuloAsistente, string> = {
  configurado: "Tarjetas listas", pendiente: "Falta crear tu primera tarjeta de sellos", en_retiro: "Tarjetas en retiro", no_contratado: "",
};
export function textoPaso(paso: PasoAsistente) {
  if (paso.paso === "modulos") return [MONEDERO[paso.monedero], TARJETAS[paso.tarjetas_sellos]].filter(Boolean).join(" · ");
  if (paso.paso === "empleados") return `${PASOS_ASISTENTE.empleados.texto} (${paso.empleados_activos} activos)`;
  return PASOS_ASISTENTE[paso.paso].texto;
}

export function EstadoPaso({ paso }: { paso: PasoAsistente }) {
  return <span className="flex flex-wrap items-center gap-2 text-sm">
    <span className="pill-badge text-muted-foreground">{paso.obligatorio ? "Obligatorio" : "Opcional"}</span>
    <span className={cn("inline-flex items-center gap-1 font-medium", paso.completo ? "text-success" : "text-muted-foreground")}>
      {paso.completo && <Check aria-hidden="true" className="size-4" />}{paso.completo ? "Listo" : "Pendiente"}
    </span>
  </span>;
}

export function PendientesAsistente({ datos }: { datos: Asistente }) {
  if (datos.mostrar_asistente || datos.configuracion_completa) return null;
  return <section className="rounded-xl bg-warn p-4 text-warn-foreground shadow-soft">
    <h2 className="text-lg font-semibold">Termina de configurar tu negocio</h2>
    <ul className="my-3 list-inside list-disc">
      {datos.pendientes_obligatorios.map((p) => <li key={p}>
        <Link to={PASOS_ASISTENTE[p].to} search={{ asistente: 1 }} className="underline underline-offset-4">{PASOS_ASISTENTE[p].titulo}</Link>
      </li>)}
    </ul>
    <Button asChild variant="secondary" className="h-auto min-h-11 whitespace-normal"><Link to="/negocio/asistente">Continuar configuración</Link></Button>
  </section>;
}