import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Alerta, EnlaceNoValido, TarjetaEnlace, useTokenFragmento } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { consultarRestablecimiento, completarRestablecimiento } from "@/lib/api/recuperacion";

export const Route = createFileRoute("/restablecer-pin")({
  head: () => ({ meta: [
    { title: "Restablecer PIN · MiSaldo" },
    { name: "description", content: "Define tu nuevo PIN con el enlace autorizado por soporte de MiSaldo." },
    { property: "og:title", content: "Restablecer PIN · MiSaldo" },
    { property: "og:description", content: "Restablece tu acceso a MiSaldo mediante un enlace de un solo uso." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: RestablecerPin,
});
export const pinRestablecimientoValido = (pin: string, repite: string) => /^\d{6}$/.test(pin) && pin === repite;
const INVALIDO = "Este enlace no es válido o ya venció. Pide a soporte de MiSaldo uno nuevo.";

function RestablecerPin() {
  const token = useTokenFragmento();
  const [datos, setDatos] = useState<{ nombre: string; expira_en: string } | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [repite, setRepite] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  const consultar = async () => {
    if (!token) return;
    setOcupado(true); setError(null);
    try { setDatos(await consultarRestablecimiento(token)); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setInvalido(true); else setError(e instanceof ApiError ? e.message : "No se pudo revisar el enlace."); }
    finally { setOcupado(false); }
  };
  useEffect(() => { if (token) void consultar(); }, [token]);
  const guardar = async () => {
    if (!token || !pinRestablecimientoValido(pin, repite) || ocupado) return;
    setOcupado(true); setError(null);
    try { await completarRestablecimiento(token, pin); setListo(true); setPin(""); setRepite(""); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) setInvalido(true);
      else setError(e instanceof ApiError && typeof e.extras["message"] === "string" ? e.extras["message"] : e instanceof ApiError ? e.message : "No se pudo guardar el PIN.");
    } finally { setOcupado(false); }
  };
  const campo = "h-12 text-center font-mono text-xl tracking-[0.3em]";
  return <TarjetaEnlace titulo={datos && !listo && !invalido ? `Hola ${datos.nombre}` : "Restablecer PIN"} icono={<KeyRound className="size-5" />}>
    {token === null || invalido ? <EnlaceNoValido mensaje={INVALIDO} /> : listo ? <>
      <Alerta tono="ok">Listo. Tu PIN se cambió y cerramos tus sesiones abiertas.</Alerta>
      <Button asChild size="lg" className="w-full"><Link to="/login">Entrar</Link></Button>
    </> : <>
      {error && <Alerta>{error}</Alerta>}
      {!datos ? <>{!error ? <p className="text-muted-foreground">Cargando…</p> : <Button disabled={ocupado} onClick={() => void consultar()}>Reintentar</Button>}</> :
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <p className="text-muted-foreground">Define tu nuevo PIN de acceso (6 dígitos).</p>
          <div className="grid gap-2"><Label htmlFor="rest-pin">PIN nuevo</Label><Input id="rest-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className={campo} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
          <div className="grid gap-2"><Label htmlFor="rest-repite">Repite el PIN</Label><Input id="rest-repite" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className={campo} value={repite} onChange={(e) => setRepite(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
          <Button type="submit" size="lg" disabled={ocupado || !pinRestablecimientoValido(pin, repite)}>Guardar PIN</Button>
        </form>}
    </>}
  </TarjetaEnlace>;
}