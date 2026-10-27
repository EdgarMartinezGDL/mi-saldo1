import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import { alertas, atenderAlerta, liberarTelefono, type Alerta, type Cursor } from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { ConfirmarMotivo, errorStaff, NOTA_AUDITORIA, useNivelStaff, useStaffNav } from "./comun";

const MSG: Record<string, string> = {
  no_encontrada: "Esta alerta ya no existe.",
  no_encontrado: "Ya no existe: recarga la lista.",
  nota_invalida: "La nota debe tener de 5 a 500 caracteres.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
};

const rolesTexto = (r: Alerta["titular"]["roles"]) =>
  [
    ...(r.dueno ?? []).map((d) => `Dueño de ${d.nombre_comercial}`),
    ...(r.empleado ?? []).map((d) => `Empleado de ${d.nombre_comercial}`),
    ...(r.cliente ? [`Cliente en ${r.cliente} ${r.cliente === 1 ? "negocio" : "negocios"}`] : []),
    ...(r.staff ? ["Staff"] : []),
  ].join(" · ") || "Sin roles";

const quien = (x: Alerta["atendida_por"]) => (typeof x === "string" ? x : x?.nombre ?? "—");

export function PestanaAlertas({ onCambio }: { onCambio: () => void }) {
  const [estado, setEstado] = useState<"pendiente" | "atendida">("pendiente");
  const [lista, setLista] = useState<Alerta[] | null>(null);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = async (mas = false) => {
    setCargando(true);
    try {
      const r = await alertas({ estado, ...(mas && siguiente ? siguiente : {}) });
      setLista((xs) => (mas && xs ? [...xs, ...r.alertas] : r.alertas));
      setSiguiente(r.siguiente);
    } catch (e) {
      errorStaff(e, MSG);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { setLista(null); void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [estado]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["pendiente", "atendida"] as const).map((e) => (
          <button key={e} type="button" onClick={() => setEstado(e)}
            className={cn("tap-target rounded-full px-4 text-sm font-semibold ring-1", estado === e ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border")}>
            {e === "pendiente" ? "Pendientes" : "Atendidas"}
          </button>
        ))}
      </div>
      {!lista ? <Cargando /> : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">{estado === "pendiente" ? "No hay alertas pendientes." : "No hay alertas atendidas."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((a) => <TarjetaAlerta key={a.validacion_id} a={a} onCambio={() => { void cargar(); onCambio(); }} />)}
        </ul>
      )}
      {siguiente && <Button variant="secondary" disabled={cargando} onClick={() => void cargar(true)}>{cargando ? "Cargando…" : "Cargar más"}</Button>}
    </div>
  );
}

function TarjetaAlerta({ a, onCambio }: { a: Alerta; onCambio: () => void }) {
  const { esAdmin } = useNivelStaff();
  const { verFicha } = useStaffNav();
  const conTotp = useConTotp();
  const [accion, setAccion] = useState<null | "atender" | "liberar">(null);
  const t = a.titular;
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="text-base">
        {a.negocio.nombre_comercial} intentó registrar como {a.tipo === "empleado" ? "empleado" : "cliente"} a <strong>{nombreCompleto(a.nombre_capturado)}</strong> con el teléfono de{" "}
        <strong>{[t.nombre, t.apellido_paterno].filter(Boolean).join(" ")}</strong> ({telefonoVisible(t.telefono)})
      </p>
      <p className="text-sm text-muted-foreground">Capturó: {a.capturado_por?.nombre ?? "—"} · Rechazada el {instante(a.rechazada_en)}</p>
      <p className="text-sm text-muted-foreground">{rolesTexto(t.roles)}</p>
      {a.atendida_en && <p className="text-sm">Atendida el {instante(a.atendida_en)} por {quien(a.atendida_por)}: {a.nota}</p>}
      <div className="flex flex-wrap gap-2">
        {!a.atendida_en && <Button size="sm" onClick={() => setAccion("atender")}>Atender</Button>}
        {!a.atendida_en && esAdmin && t.telefono && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAccion("liberar")}>El número cambió de dueño: liberar</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => verFicha(t.persona_id)}>Ver ficha</Button>
      </div>
      <ConfirmarMotivo abierto={accion === "atender"} onAbierto={(o) => !o && setAccion(null)} titulo="¿Marcar la alerta como atendida?"
        etiqueta="Nota" nota={NOTA_AUDITORIA} boton="Sí, atender"
        accion={async (nota) => {
          try {
            await atenderAlerta(a.validacion_id, nota);
            toast.success("Alerta atendida");
            setAccion(null);
            onCambio();
          } catch (e) { errorStaff(e, MSG); throw e; }
        }} />
      <ConfirmarMotivo abierto={accion === "liberar"} onAbierto={(o) => !o && setAccion(null)} destructivo
        titulo={`¿Liberar el ${telefonoVisible(t.telefono)} de ${t.nombre}?`}
        descripcion="Quita el número, cierra todas sus sesiones y anula sus invitaciones y solicitudes pendientes. El aviso le llega solo por correo. La alerta queda atendida."
        nota={NOTA_AUDITORIA} boton="Sí, liberar"
        accion={async (motivo) => {
          try {
            const r = await conTotp(() => liberarTelefono(t.persona_id, { validacion_id: a.validacion_id, motivo }));
            toast.success(`Teléfono liberado. Sesiones cerradas: ${r.sesiones_revocadas}`, {
              description: r.tiene_correo ? undefined : "No tiene correo: no podrá recuperar su cuenta hasta que le asignes un número",
            });
            setAccion(null);
            onCambio();
          } catch (e) { errorStaff(e, MSG); throw e; }
        }} />
    </li>
  );
}
