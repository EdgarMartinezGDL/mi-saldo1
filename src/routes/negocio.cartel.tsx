import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { CopiarEnlace } from "@/components/copiar-enlace";
import { nuevoCodigoRegistro } from "@/lib/api/registro";
import { ApiError } from "@/lib/api/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequiereSesion } from "@/components/requiere-sesion";
import { useConfigNegocio } from "@/components/negocio/comun";
import { useEnlaceRegistro } from "@/components/qr-registro";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/negocio/cartel")({
  head: () => ({ meta: [
    { title: "Cartel de registro · Mi Saldo Vip" },
    { name: "description", content: "Imprime el cartel de registro de tu negocio con su código QR." },
    { property: "og:title", content: "Cartel de registro · Mi Saldo Vip" },
    { property: "og:description", content: "Un cartel para que tus clientes se unan a Mi Saldo Vip." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <RequiereSesion titulo="Cartel de registro" roles={["dueno"]}><CartelRegistro /></RequiereSesion>,
});

export function CartelRegistro() {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const renovar = async () => {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true);
    try {
      const codigo = await nuevoCodigoRegistro();
      queryClient.setQueryData(["mi-codigo-registro"], codigo);
      setConfirmando(false);
      toast.success("Listo: el enlace anterior ya no funciona");
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 429 ? "Ya generaste varios enlaces en la última hora. Intenta más tarde." : e instanceof ApiError ? e.message : "No pudimos generar el enlace. Intenta de nuevo.");
    } finally { bloqueo.current = false; setOcupado(false); }
  };
  const { nombre, enlace, conRegistro } = useEnlaceRegistro();
  const cfg = useConfigNegocio();
  const [logoFallido, setLogoFallido] = useState<string | null>(null);
  const logo = cfg.data?.negocio.logo_url;
  return <AppShell>
    <div className="cartel-controles mb-5 flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="link" className="min-h-12 px-0 text-base" asChild><Link to="/panel">← Volver al panel</Link></Button>
      {nombre && enlace && <Button className="min-h-12 text-base" onClick={() => window.print()}><Printer /> Imprimir</Button>}
      <p className="w-full text-sm text-muted-foreground">Sale en una hoja tamaño carta. Pégalo cerca de la caja.</p>
    </div>
    {!nombre || !enlace ? <p>No pudimos preparar el cartel.</p> : <>
      <section aria-label="Vista previa del cartel" className="cartel-hoja relative mx-auto aspect-[8.5/11] w-full max-w-[640px] overflow-hidden border border-border bg-qr-fondo text-center text-qr-texto">
        <div className="cartel-contenido flex flex-col items-center justify-center gap-6 px-8 py-6">
        {logo && logo !== logoFallido ? <img src={logo} alt={nombre} onError={() => setLogoFallido(logo)} className="h-24 max-w-full shrink-0 object-contain" />
          : <div aria-label={`Inicial de ${nombre}`} className="grid size-24 shrink-0 place-items-center rounded-full border border-qr-texto text-4xl font-bold">{Array.from(nombre)[0]?.toUpperCase()}</div>}
        <h1 className="line-clamp-2 w-full text-4xl font-bold [overflow-wrap:anywhere]">{nombre}</h1>
        <QRCodeSVG value={enlace} level="M" marginSize={2} size={360} aria-label="Código QR de registro" className="cartel-qr h-auto w-[min(70%,360px)] shrink-0" />
        <h2 className="text-3xl font-bold">Escanea y únete a Mi Saldo Vip</h2>
        <p className="text-sm">{conRegistro ? "Abre la cámara de tu celular, apunta al código y regístrate en un minuto" : "Abre la cámara de tu celular y apunta al código"}</p>
        <p className="text-sm">Mi Saldo Vip · By MicroFix Cloud</p>
        </div>
      </section>
      <div className="cartel-controles mt-4 space-y-2 print:hidden">
        <p className="break-all text-sm text-muted-foreground">Este cartel abre: {enlace}</p>
        <CopiarEnlace enlace={enlace} campoVisible={conRegistro} nombreNegocio={nombre} />
        {sesion?.contexto.rol === "dueno" && <Button variant="secondary" className="min-h-12 text-base" disabled={ocupado} onClick={() => setConfirmando(true)}><RefreshCw />Generar enlace nuevo</Button>}
        {!enlace.startsWith("https://") && <p className="text-sm text-warn-texto">Ojo: estás en una dirección de prueba. Imprime el cartel desde la dirección final de la app.</p>}
      </div>
    </>}
    <AlertDialog open={confirmando} onOpenChange={(v) => { if (!ocupado) setConfirmando(v); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Generar un enlace nuevo?</AlertDialogTitle><AlertDialogDescription>El QR impreso y los enlaces que ya compartiste dejarán de funcionar. Tendrás que imprimir el cartel otra vez.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={ocupado} onClick={(e) => { e.preventDefault(); void renovar(); }}>Generar enlace nuevo</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </AppShell>;
}