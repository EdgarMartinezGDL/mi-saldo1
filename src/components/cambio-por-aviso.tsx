import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useMiSaldo } from "@/components/misaldo-provider";
import { etiquetaContexto } from "@/components/mis-negocios";
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
import { cambiarContexto, contextos, type ContextoDisponible } from "@/lib/api/auth";
import { leerNegocioAviso, quitarNegocioAviso } from "@/lib/negocio-aviso";

type Pendiente = { destino: ContextoDisponible; ruta: string; actual: string };

/** Switches to the client profile of the business that sent a push notice (?negocio=). */
export function CambioPorAviso({ children }: { children: ReactNode }) {
  const { estado, sesion } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { updateBusiness } = useMiSaldo();
  const leido = useRef<{ negocio: string | null; ruta: string } | null>(null);
  if (leido.current === null) {
    const negocio = typeof window === "undefined" ? null : leerNegocioAviso(window.location.search);
    const ruta = negocio ? quitarNegocioAviso(window.location.pathname, window.location.search, window.location.hash) : "";
    leido.current = { negocio, ruta };
  }
  const { negocio, ruta } = leido.current;
  const [listo, setListo] = useState(negocio === null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const corrio = useRef(false);

  useEffect(() => {
    if (negocio) window.history.replaceState(window.history.state, "", ruta);
    if (!negocio) return;
    const t = setTimeout(() => setListo(true), 8000);
    return () => clearTimeout(t);
  }, [negocio, ruta]);

  const cambiar = async (negocioId: string) => {
    const s = await cambiarContexto({ rol: "cliente", negocio_id: negocioId });
    queryClient.clear();
    updateBusiness({ name: s.contexto.nombre_comercial ?? "Mi Saldo Vip", logo: null });
    toast.success(`Ahora estás en ${etiquetaContexto(s.contexto)}`);
  };

  useEffect(() => {
    if (!negocio || corrio.current || estado === "comprobando") return;
    corrio.current = true;
    if (estado !== "autenticado" || !sesion) return setListo(true);
    const actual = sesion.contexto;
    if (actual.rol === "cliente" && actual.negocio_id === negocio) return setListo(true);
    void (async () => {
      try {
        const { contextos: lista } = await queryClient.fetchQuery({ queryKey: ["contextos"], queryFn: contextos, staleTime: 5 * 60_000 });
        const destino = lista.find((c) => c.rol === "cliente" && c.negocio_id === negocio);
        if (!destino) return;
        if (destino.requiere_pin || destino.requiere_totp) {
          toast.info(`Esta promoción es de ${destino.nombre_comercial ?? "otro negocio"}. Para verla, cámbiate a ese negocio en Mis negocios.`);
          return;
        }
        if (actual.rol === "cliente") await cambiar(negocio);
        else setPendiente({ destino, ruta, actual: etiquetaContexto(actual) });
      } catch {
        // Keep the current business; a 401 is already handled by the API client.
      } finally {
        setListo(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio, estado, sesion]);

  if (!listo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6" role="status">
        <p className="text-muted-foreground">Abriendo la promoción…</p>
      </div>
    );
  }
  return (
    <>
      {children}
      {pendiente && (
        <AlertDialog open onOpenChange={(v) => !v && setPendiente(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promoción de {pendiente.destino.nombre_comercial}</AlertDialogTitle>
              <AlertDialogDescription>
                Para verla hay que cambiar a tu perfil de cliente de ese negocio. Para volver a {pendiente.actual} te podemos pedir tu PIN.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quedarme aquí</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const p = pendiente;
                  setPendiente(null);
                  void cambiar(p.destino.negocio_id as string)
                    .then(() => navigate({ to: p.ruta, replace: true }))
                    .catch(() => {});
                }}
              >
                Ver la promoción
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
