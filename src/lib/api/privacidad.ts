import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "./client";

export interface AvisoPrivacidad {
  version: string; vigente_desde: string; provisional: boolean; resumen: string;
  secciones: { titulo: string; parrafos: string[] }[];
  vigente: boolean; version_vigente: string; contacto_arco: string; versiones: string[];
}
export const avisoPrivacidad = () => api<AvisoPrivacidad>("/api/aviso-privacidad", { auth: false });
export const avisoQuery = () => queryOptions({ queryKey: ["aviso-privacidad"], queryFn: avisoPrivacidad, staleTime: 5 * 60_000, retry: false });
export const fechaAviso = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Consent is kept only in the form; outdated versions never clear other inputs. */
export function useConsentimiento() {
  const client = useQueryClient();
  const [aviso, setAviso] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const desactualizado = (error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 409 || error.codigo !== "aviso_desactualizado") return false;
    setAviso(false); setVersion(null);
    void client.invalidateQueries({ queryKey: ["aviso-privacidad"] });
    return true;
  };
  return { aviso, setAviso, version, setVersion, desactualizado };
}