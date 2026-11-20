import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { enlaceRegistro, miCodigoRegistro } from "@/lib/api/registro";
import { CopiarEnlace } from "@/components/copiar-enlace";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { enlaceBienvenida, limpiarNombreNegocio } from "@/lib/bienvenida";

export function useEnlaceRegistro() {
  const { sesion } = useAuth();
  const nombre = limpiarNombreNegocio(sesion?.contexto.nombre_comercial ?? null);
  const permitido = sesion?.contexto.rol === "dueno" || sesion?.contexto.rol === "empleado";
  const compartido = useContext(QueryClientContext);
  const [aislado] = useState(() => new QueryClient());
  const registro = useQuery({ queryKey: ["mi-codigo-registro"], queryFn: miCodigoRegistro, retry: false, staleTime: 5 * 60_000, enabled: permitido && !!nombre }, compartido ?? aislado);
  const codigo = registro.data?.codigo;
  const origen = typeof window === "undefined" ? null : window.location.origin;
  const enlace = permitido && nombre && origen
    ? codigo ? enlaceRegistro(origen, codigo) : enlaceBienvenida(origen, nombre)
    : null;
  return { nombre, enlace, conRegistro: !!enlace && !!codigo };
}

export function BotonQrRegistro({ onAbiertoChange, abierto: abiertoExterno, onSolicitarCambio, sinBoton = false }: { onAbiertoChange?: (abierto: boolean) => void; abierto?: boolean; onSolicitarCambio?: (abierto: boolean) => void; sinBoton?: boolean }) {
  const { nombre, enlace, conRegistro } = useEnlaceRegistro();
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const abierto = abiertoExterno ?? abiertoInterno;
  const solicitar = useRef(onSolicitarCambio);
  solicitar.current = onSolicitarCambio;
  const setAbierto = (v: boolean) => { if (abiertoExterno === undefined) setAbiertoInterno(v); solicitar.current?.(v); };
  const setAbiertoRef = useRef(setAbierto);
  setAbiertoRef.current = setAbierto;
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const cambio = useRef(onAbiertoChange);
  cambio.current = onAbiertoChange;
  const visible = abierto && !!enlace && !!nombre;

  useEffect(() => {
    if (!visible) return;
    cambio.current?.(true);
    const entrada = crypto.randomUUID();
    history.pushState({ ...history.state, qrRegistro: entrada }, "", window.location.href);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrar.current?.focus({ preventScroll: true });
    let activo = true;
    let bloqueo: WakeLockSentinel | undefined;
    void (async () => {
      try {
        const solicitado = await navigator.wakeLock?.request("screen");
        if (!activo) await solicitado?.release();
        else bloqueo = solicitado;
      } catch { /* Mantener la pantalla encendida es opcional. */ }
    })();
    const atras = () => { if (history.state?.qrRegistro !== entrada) setAbiertoRef.current(false); };
    const tecla = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === "Escape") { e.preventDefault(); setAbiertoRef.current(false); }
      if (e.key === "Tab") {
        const controles = Array.from(capa.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? []);
        const indice = controles.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        controles[(indice + (e.shiftKey ? -1 : 1) + controles.length) % controles.length]?.focus();
      }
    };
    window.addEventListener("popstate", atras);
    window.addEventListener("keydown", tecla, true);
    return () => {
      activo = false;
      window.removeEventListener("popstate", atras);
      window.removeEventListener("keydown", tecla, true);
      if (history.state?.qrRegistro === entrada) history.back();
      void bloqueo?.release().catch(() => {});
      document.body.style.overflow = overflow;
      cambio.current?.(false);
      boton.current?.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!nombre || !enlace) return null;
  return <>
    {!sinBoton && <Button ref={boton} variant="secondary" className="min-h-12 text-base" onClick={() => setAbierto(true)}>
      <QrCode /> Mostrar QR de registro
    </Button>}
    {visible && createPortal(
      <div ref={capa} role="dialog" aria-modal="true" aria-label="QR de registro"
        className="fixed inset-0 z-[1000] flex flex-col items-center justify-between gap-3 overflow-y-auto bg-qr-fondo p-4 text-center text-qr-texto sm:p-6">
        <h2 className="line-clamp-2 w-full shrink-0 break-words text-3xl font-bold [overflow-wrap:anywhere]">{nombre}</h2>
        <div className="shrink-0 [&_svg]:!size-[min(85vw,60vh)]">
          <QRCodeSVG value={enlace} level="M" marginSize={2} size={512} aria-label="Código QR de registro" />
        </div>
        <div className="shrink-0">
          <p className="text-xl font-semibold">Escanea este código con la cámara de tu celular</p>
          {conRegistro && <div className="mx-auto mt-3 flex max-w-md flex-col items-center gap-2"><CopiarEnlace enlace={enlace} campoVisible enQr nombreNegocio={nombre} /><p className="text-sm">Envíaselo al cliente si no puede escanear el código.</p></div>}
          <p className="mt-2 text-sm">{conRegistro ? "Regístrate en Mi Saldo Vip desde tu celular" : "Te explica cómo registrarte en Mi Saldo Vip"}</p>
        </div>
        <Button ref={cerrar} variant="secondary" className="min-h-14 w-full max-w-md shrink-0 border-qr-texto bg-qr-fondo text-xl text-qr-texto hover:bg-qr-fondo" onClick={() => setAbierto(false)}>Cerrar</Button>
      </div>, document.body,
    )}
  </>;
}