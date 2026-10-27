import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-provider";
import { Alerta, AvisoPrivacidad } from "./enlace-ui";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./ui/alert-dialog";
import { aceptarAviso, perfil } from "@/lib/api/cliente";
import { ApiError } from "@/lib/api/client";
import { useConsentimiento } from "@/lib/api/privacidad";

export function AvisoPendiente() {
  const { sesion, estado } = useAuth();
  const client = useQueryClient();
  const datos = useQuery({ queryKey: ["perfil"], queryFn: perfil, enabled: estado === "autenticado" && !!sesion, retry: false });
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [error, setError] = useState<string | null>(null);
  const aceptar = useMutation({
    mutationFn: aceptarAviso,
    onSuccess: () => {
      client.setQueryData(["perfil"], (p: typeof datos.data) => p ? { ...p, aviso_privacidad: { ...p.aviso_privacidad, requiere_aceptar: false } } : p);
      void client.invalidateQueries({ queryKey: ["perfil"] });
    },
    onError: (e) => { desactualizado(e); setError(e instanceof ApiError ? String(e.extras["message"] ?? e.message) : "No pudimos guardar tu aceptación. Intenta de nuevo."); },
  });
  if (!sesion || estado !== "autenticado") return null;
  return <AlertDialog open={datos.data?.aviso_privacidad?.requiere_aceptar === true}>
    <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto" onEscapeKeyDown={(e) => e.preventDefault()}>
      <AlertDialogTitle>Actualizamos nuestro aviso de privacidad</AlertDialogTitle>
      <AlertDialogDescription asChild><div><AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} /></div></AlertDialogDescription>
      {error && <Alerta>{error}</Alerta>}
      <Button disabled={!aviso || !version || aceptar.isPending} onClick={() => { if (!version || !aviso || aceptar.isPending) return; setError(null); aceptar.mutate(version); }}>Aceptar y continuar</Button>
    </AlertDialogContent>
  </AlertDialog>;
}