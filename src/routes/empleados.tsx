import { BarraAsistente } from "@/components/negocio/barra-asistente";
import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { altaEmpleado, bajaEmpleado, empleados, reenviarInvitacion, type Empleado } from "@/lib/api/dueno";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/empleados")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "Empleados · MiSaldo" },
      { name: "description", content: "Da de alta cajeros, reenvía invitaciones y da de baja empleados del negocio." },
      { property: "og:title", content: "Empleados · MiSaldo" },
      { property: "og:description", content: "Administra el equipo que atiende la caja de tu negocio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Empleados" roles={["dueno"]}>
      <Empleados />
    </RequiereSesion>
  ),
});

const error = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo.");

function Empleados() {
  const invalidarAsistente = useInvalidarAsistente();
  const [lista, setLista] = useState<Empleado[] | null>(null);
  const [form, setForm] = useState(false);
  const [tel, setTel] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const refForm = useDesplazarAlAbrir(form, true);

  const cargar = useCallback(() => empleados().then(setLista).catch(error), []);
  useEffect(() => void cargar(), [cargar]);

  const alta = async () => {
    setOcupado(true);
    try {
      const r = await altaEmpleado({ telefono: telefonoE164(tel), nombre: nombre.trim(), apellido_paterno: apellido.trim() || null, apellido_materno: null });
      invalidarAsistente();
      if (r.validacion_id) toast.info("Este número ya está registrado con otro nombre. Le pedimos al titular que confirme.");
      else if (r.invitacion_vence_en) toast.success("Empleado agregado", { description: "Le enviamos una invitación por WhatsApp." });
      else toast.success(r.resultado === "reactivado" ? "Empleado reactivado" : "Empleado agregado");
      setTel("");
      setNombre("");
      setApellido("");
      setForm(false);
      await cargar();
    } catch (e) {
      error(e);
    } finally {
      setOcupado(false);
    }
  };

  const reenviar = async (id: string) => {
    try {
      await reenviarInvitacion(id);
      invalidarAsistente();
      toast.success("Invitación reenviada por WhatsApp");
      await cargar();
    } catch (e) {
      error(e);
    }
  };

  const baja = async (emp: Empleado) => {
    if (!window.confirm(`¿Dar de baja a ${emp.nombre}? Su sesión y su caja se cierran al instante.`)) return;
    try {
      await bajaEmpleado(emp.negocio_empleado_id);
      invalidarAsistente();
      toast.success("Empleado dado de baja");
      await cargar();
    } catch (e) {
      error(e);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <BarraAsistente />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Empleados</h1>
          <p className="mt-1 text-base text-muted-foreground">Las personas que atienden tu caja.</p>
        </div>

        {form ? (
          <section ref={refForm} className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="text-lg font-semibold tracking-tight">Nuevo empleado</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tel">Teléfono (10 dígitos)</Label>
                <Input id="tel" inputMode="numeric" className="h-12 font-mono" value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nom">Nombre</Label>
                <Input id="nom" className="h-12" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ape">Apellido</Label>
                <Input id="ape" className="h-12" value={apellido} onChange={(e) => setApellido(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button disabled={ocupado || tel.length !== 10 || !nombre.trim()} onClick={() => void alta()}>
                {ocupado ? "Guardando…" : "Agregar"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(false)}>
                Cancelar
              </Button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setForm(true)}
            className="tap-target flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-base font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="size-5" /> Nuevo empleado
          </button>
        )}

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {!lista ? (
            <Cargando />
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes empleados.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lista.map((emp) => (
                <li key={emp.negocio_empleado_id} className={cn("flex flex-wrap items-center justify-between gap-3 py-3", !emp.activo && "opacity-60")}>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{nombreCompleto(emp)}</p>
                    <p className="text-sm text-muted-foreground">
                      {telefonoVisible(emp.telefono)} ·{" "}
                      {!emp.activo
                        ? `Baja ${instante(emp.dado_de_baja_en)}`
                        : emp.cuenta_activada
                          ? "Activo"
                          : emp.invitacion_vence_en
                            ? `Invitación vence ${instante(emp.invitacion_vence_en)}`
                            : "Invitación vencida"}
                    </p>
                  </div>
                  {emp.activo && (
                    <div className="flex gap-2">
                      {!emp.cuenta_activada && (
                        <Button size="sm" variant="secondary" onClick={() => void reenviar(emp.negocio_empleado_id)}>
                          Reenviar invitación
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void baja(emp)}>
                        Dar de baja
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
