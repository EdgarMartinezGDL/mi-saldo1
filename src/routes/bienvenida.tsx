import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { roleHome } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { TarjetaEnlace } from "@/components/enlace-ui";
import { MarcaMiSaldo } from "@/components/marca";
import { Button } from "@/components/ui/button";
import { limpiarNombreNegocio } from "@/lib/bienvenida";

export const Route = createFileRoute("/bienvenida")({
  head: () => ({ meta: [
    { title: "Bienvenido · Mi Saldo Vip" },
    { name: "description", content: "Cómo registrarte y activar tu app de Mi Saldo Vip en el negocio." },
    { property: "og:title", content: "Bienvenido · Mi Saldo Vip" },
    { property: "og:description", content: "Regístrate con el cajero y empieza a acumular desde tu compra." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Bienvenida,
});

function Bienvenida() {
  const { sesion } = useAuth();
  const [nombre, setNombre] = useState<string | null>(null);
  useEffect(() => {
    setNombre(limpiarNombreNegocio(new URLSearchParams(window.location.hash.slice(1)).get("n")));
  }, []);
  const titulo = nombre ? `Te damos la bienvenida a ${nombre}` : "Te damos la bienvenida a Mi Saldo Vip";
  return <TarjetaEnlace titulo={titulo} icono={null} encabezado={
    <header className="mb-6">
      <p className="mb-4 text-xl text-primary-texto"><MarcaMiSaldo /></p>
      <h1 className="break-words text-2xl font-semibold [overflow-wrap:anywhere]">{titulo}</h1>
      {nombre && <p className="mt-2 text-sm text-muted-foreground">Este negocio usa Mi Saldo Vip para premiar tus compras</p>}
    </header>
  }>
    <h2 className="mb-4 text-2xl font-semibold">¿Cómo me registro?</h2>
    <ol className="flex flex-col gap-6 text-lg leading-relaxed">
      <li className="flex gap-3"><span className="font-bold text-primary-texto">1.</span><div><p className="font-semibold">Dale tu número de celular al cajero.</p><p>Te registra en ese momento y desde esta compra empiezas a acumular.</p></div></li>
      <li className="flex gap-3"><span className="font-bold text-primary-texto">2.</span><div><p className="font-semibold">Abre el mensaje que te enviamos.</p><p>Te llega por WhatsApp y por correo, con un enlace para activar tu app. Ahí creas tu PIN y tus códigos.</p></div></li>
      <li className="flex gap-3"><span className="font-bold text-primary-texto">3.</span><div><p className="font-semibold">Instala la app en tu celular.</p><p className="mt-2">Android: En Chrome, toca ⋮ y luego <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</p><p className="mt-2">iPhone: En Safari, toca <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong>.</p></div></li>
    </ol>
    <div className="my-6 flex gap-3 rounded-lg border border-border bg-secondary p-4">
      <ShieldCheck className="size-6 shrink-0 text-primary-texto" />
      <p className="text-base">Registrarte es gratis. Nadie de Mi Saldo Vip ni del negocio te pedirá tu PIN de acceso (6 dígitos) ni tu PIN de canje (4 dígitos) por mensaje o llamada.</p>
    </div>
    <Button asChild variant="secondary" className="min-h-12 w-full whitespace-normal text-base">
      <Link to={sesion ? roleHome(sesion.contexto.rol) : "/login"}>{sesion ? "Ir a mi app" : "Ya tengo cuenta: entrar"}</Link>
    </Button>
    <Link to="/aviso-privacidad" className="mt-5 flex min-h-11 items-center justify-center text-center text-primary-texto underline">Aviso de privacidad</Link>
  </TarjetaEnlace>;
}