import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { createFileRoute } from "@tanstack/react-router";
import { Moon, Palette, RotateCcw, Sun } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useMiSaldo, type ThemeMode } from "@/components/misaldo-provider";
import { ConConfig, mostrarError, SeccionNegocio, useConfigNegocio } from "@/components/negocio/comun";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfiguracionNegocio } from "@/lib/api/caja";
import { actualizarNegocio } from "@/lib/api/dueno";

export const Route = createFileRoute("/negocio/marca")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "Datos y marca · MiSaldo" },
      { name: "description", content: "Nombre, giro, logotipo, tema y color de tu negocio." },
      { property: "og:title", content: "Datos y marca · MiSaldo" },
      { property: "og:description", content: "Así verán tus clientes tu negocio en MiSaldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Datos y marca" descripcion="Así verán tus clientes la aplicación.">
      <ConConfig>{(c) => <Marca cfg={c} />}</ConConfig>
    </SeccionNegocio>
  ),
});

const TEMAS = [
  { id: 1 as const, value: "claro" as const, label: "Claro", icon: Sun },
  { id: 2 as const, value: "oscuro" as const, label: "Oscuro", icon: Moon },
  { id: 3 as const, value: "personalizado" as const, label: "Personalizado", icon: Palette },
];

type Valores = { nombre: string; giro: string; logo: string; tema: 1 | 2 | 3 };

function Marca({ cfg }: { cfg: ConfiguracionNegocio }) {
  const invalidarAsistente = useInvalidarAsistente();
  const { updateBusiness, theme, setTheme, customColor, setCustomColor, restoreDefaultColors } = useMiSaldo();
  const { actualizar } = useConfigNegocio();
  const inicial: Valores = {
    nombre: cfg.negocio.nombre_comercial,
    giro: cfg.negocio.giro ?? "",
    logo: cfg.negocio.logo_url ?? "",
    tema: (cfg.negocio.tema_id ?? 2) as 1 | 2 | 3,
  };
  const { editando, valores, set, editar: editarBase, cancelar: cancelarBase, terminar, guardado, cambiado, ref } = useModoEdicion(inicial);
  const [ocupado, setOcupado] = useState(false);
  const colorPrevio = useRef(customColor);

  const applyBrandColor = (hex: string) => {
    setCustomColor(hex);
    setTheme("personalizado");
    set("tema", 3);
  };
  const selectTheme = (t: ThemeMode, id: 1 | 2 | 3) => {
    setTheme(t);
    set("tema", id);
  };
  const restoreColors = () => {
    restoreDefaultColors();
    set("tema", 2);
    toast.success("Colores restaurados", { description: "Volviste a la paleta azul marino y teal." });
  };
  const editar = () => {
    colorPrevio.current = customColor;
    editarBase();
  };
  const cancelar = () => {
    cancelarBase();
    setTheme(TEMAS.find((t) => t.id === guardado.tema)?.value ?? "oscuro");
    setCustomColor(colorPrevio.current);
  };

  const guardar = async () => {
    if (valores.logo && !/^https:\/\//.test(valores.logo)) {
      toast.error("El logotipo debe ser un enlace que empiece con https://");
      return;
    }
    setOcupado(true);
    try {
      const n = await actualizarNegocio({ nombre_comercial: valores.nombre.trim(), giro: valores.giro.trim() || null, logo_url: valores.logo.trim() || null, tema_id: valores.tema });
      invalidarAsistente();
      updateBusiness({ name: n.nombre_comercial, logo: n.logo_url });
      actualizar((c) => ({ ...c, negocio: { ...c.negocio, ...n, giro: valores.giro.trim() || null, tema_id: valores.tema } }));
      toast.success("Datos del negocio guardados");
      terminar({ nombre: valores.nombre.trim(), giro: valores.giro.trim(), logo: valores.logo.trim(), tema: valores.tema });
    } catch (e) {
      mostrarError(e);
    } finally {
      setOcupado(false);
    }
  };

  const temaLabel = TEMAS.find((t) => t.id === guardado.tema)?.label ?? "Oscuro";

  return (
    <>
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <h2 className="text-lg font-semibold tracking-tight">Logotipo y nombre</h2>
        {editando ? (
          <div ref={ref} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {valores.logo ? (
                <img src={valores.logo} alt="Logotipo del negocio" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
              ) : (
                <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-secondary text-sm text-muted-foreground">Sin logo</div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="logo" className="text-base">Enlace del logotipo (https://)</Label>
                <Input id="logo" value={valores.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https://…/logo.png" className="h-14 text-base" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre" className="text-base">Nombre del negocio</Label>
                <Input id="nombre" value={valores.nombre} maxLength={150} onChange={(e) => set("nombre", e.target.value)} className="h-14 text-base" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="giro" className="text-base">Giro</Label>
                <Input id="giro" value={valores.giro} maxLength={100} onChange={(e) => set("giro", e.target.value)} placeholder="Cafetería" className="h-14 text-base" />
              </div>
            </div>
            <div>
              <p className="text-base font-medium">Tema visual</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {TEMAS.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    variant={theme === o.value ? "default" : "secondary"}
                    aria-pressed={theme === o.value}
                    onClick={() => selectTheme(o.value, o.id)}
                    className="h-14 justify-start px-4 text-base"
                  >
                    <o.icon className="size-5" />
                    {o.label}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-3 h-12 w-full sm:w-auto" onClick={restoreColors}>
                <RotateCcw className="size-4" />
                Restaurar colores por defecto
              </Button>
            </div>
            {theme === "personalizado" && (
              <div className="rounded-xl p-4 ring-1 ring-border">
                <h3 className="text-base font-semibold">Color de tu marca</h3>
                <p className="mt-1 text-sm text-muted-foreground">Se aplica en esta aplicación.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    aria-label="Elegir color principal"
                    value={customColor}
                    onChange={(e) => applyBrandColor(e.target.value)}
                    className="size-14 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent"
                  />
                  <Input
                    value={customColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomColor(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) applyBrandColor(v);
                    }}
                    className="h-14 w-40 font-mono text-base"
                    aria-label="Color hexadecimal"
                  />
                  <span className="rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground">Vista previa</span>
                </div>
              </div>
            )}
            <BotonesEdicion textoGuardar="Guardar datos" ocupado={ocupado} cambiado={cambiado && !!valores.nombre.trim()} onGuardar={() => void guardar()} onCancelar={cancelar} />
          </div>
        ) : (
          <VistaLectura
            onEditar={editar}
            datos={[
              { etiqueta: "Nombre del negocio", valor: guardado.nombre },
              { etiqueta: "Giro", valor: guardado.giro || "—" },
              { etiqueta: "Tema visual", valor: temaLabel },
            ]}
          >
            <div className="flex items-center gap-4">
              {guardado.logo ? (
                <img src={guardado.logo} alt="Logotipo del negocio" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
              ) : (
                <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-secondary text-sm text-muted-foreground">Sin logo</div>
              )}
            </div>
          </VistaLectura>
        )}
      </section>
    </>
  );
}
