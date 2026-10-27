import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { misValidaciones, type ResultadoValidacion, type Validacion } from "@/lib/api/enlaces";

export const MIS_VALIDACIONES_KEY = ["mis-validaciones"] as const;

/** Single shared source for /api/mis-validaciones: header counter and /validaciones page. */
export function useMisValidaciones() {
  const { estado } = useAuth();
  return useQuery({
    queryKey: MIS_VALIDACIONES_KEY,
    queryFn: misValidaciones,
    enabled: estado === "autenticado",
  });
}

/** Marks one validación as answered in the cache so the counter drops immediately. */
export function useResolverValidacionEnCache() {
  const queryClient = useQueryClient();
  return (validacionId: string, resultado: ResultadoValidacion) => {
    queryClient.setQueryData<{ validaciones: Validacion[] }>(MIS_VALIDACIONES_KEY, (actual) =>
      actual
        ? {
            validaciones: actual.validaciones.map((v) =>
              v.validacion_id === validacionId
                ? { ...v, estado: resultado.estado, resuelto_en: new Date().toISOString() }
                : v,
            ),
          }
        : actual,
    );
  };
}
