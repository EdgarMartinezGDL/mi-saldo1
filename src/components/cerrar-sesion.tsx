import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useMiSaldo } from "@/components/misaldo-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logout } from "@/lib/api/auth";

/** Single shared sign-out confirmation used by Ajustes and the desktop sidebar. */
export function useCerrarSesion(): { pedirConfirmacion: () => void; dialogo: ReactNode } {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resetSessionData } = useMiSaldo();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      await logout();
    } finally {
      queryClient.clear();
      resetSessionData();
      setAbierto(false);
      setSaliendo(false);
      void navigate({ to: "/login", replace: true });
    }
  };

  const dialogo = (
    <AlertDialog open={abierto} onOpenChange={(o) => !saliendo && setAbierto(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
          <AlertDialogDescription>¿Estás seguro de que deseas cerrar sesión?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saliendo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void cerrarSesion();
            }}
            disabled={saliendo}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {saliendo ? "Saliendo…" : "Sí, cerrar sesión"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { pedirConfirmacion: () => setAbierto(true), dialogo };
}
