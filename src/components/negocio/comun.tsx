import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { configuracion, type ConfiguracionNegocio } from "@/lib/api/caja";
import { BarraAsistente } from "./barra-asistente";

/** Business configuration shared by the hub and every /negocio/* section. */
export function useConfigNegocio() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["negocio-configuracion"],
    queryFn: async () => (await configuracion()) as ConfiguracionNegocio,
  });
  const actualizar = (fn: (c: ConfiguracionNegocio) => ConfiguracionNegocio) =>
    queryClient.setQueryData<ConfiguracionNegocio>(["negocio-configuracion"], (c) => (c ? fn(c) : c));
  return { ...q, actualizar };
}

export const mostrarError = (e: unknown, propio?: Record<string, string>) => {
  const err = e instanceof ApiError ? e : null;
  const r = err?.extras["intentos_restantes"];
  toast.error((err?.codigo && propio?.[err.codigo]) || err?.message || "No se pudo guardar.", {
    description: typeof r === "number" ? `Te quedan ${r} intentos.` : undefined,
  });
};

/** Owner-only section page with its title and "← Negocio". */
export function SeccionNegocio({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <RequiereSesion titulo={titulo} roles={["dueno"]}>
      <AppShell volver="/negocio" volverTexto="Negocio">
        <div className="flex flex-col gap-6">
          <BarraAsistente />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
            {descripcion && <p className="mt-1 text-base text-muted-foreground">{descripcion}</p>}
          </div>
          {children}
        </div>
      </AppShell>
    </RequiereSesion>
  );
}

/** Renders children once the configuration is loaded. */
export function ConConfig({ children }: { children: (c: ConfiguracionNegocio) => ReactNode }) {
  const { data, error } = useConfigNegocio();
  if (error) return <p className="rounded-xl bg-destructive/10 p-4 text-destructive">{error instanceof Error ? error.message : "No se pudo cargar."}</p>;
  if (!data) return <Cargando />;
  return <>{children(data)}</>;
}
