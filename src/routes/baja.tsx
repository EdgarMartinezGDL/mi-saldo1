import { createFileRoute, Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, setSesion } from "@/lib/api/client";
import { darmeDeBaja, vistaBaja, type VistaBaja } from "@/lib/api/cliente";
import { pesos } from "@/lib/api/formato";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/baja")({
  head: () => ({
    meta: [
      { title: "Darme de baja · MiSaldo" },
      { name: "description", content: "Baja voluntaria de un negocio: revisa lo que pierdes antes de confirmar con tu PIN." },
      { property: "og:title", content: "Darme de baja · MiSaldo" },
      { property: "og:description", content: "Baja inmediata e irreversible con vista previa de tu saldo y sellos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Baja,
});

function Baja() {
  const [hecha, setHecha] = useState(false);
  const refHecha = useDesplazarAlAbrir(hecha);
  if (hecha) {
    return (
      <AppShell>
        <div ref={refHecha} className="rounded-2xl bg-card p-6 ring-1 ring-border">
          <h1 className="text-2xl font-semibold tracking-tight">Tu baja quedó registrada</h1>
          <p className="mt-2 text-muted-foreground">Te enviamos un comprobante por WhatsApp y correo.</p>
          <Button asChild className="mt-4">
            <Link to="/login">Ir al inicio</Link>
          </Button>
        </div>
      </AppShell>
    );
  }
  return (
    <RequiereSesion titulo="Darme de baja" roles={["cliente"]}>
      <Formulario onHecha={() => setHecha(true)} />
    </RequiereSesion>
  );
}

function Formulario({ onHecha }: { onHecha: () => void }) {
  const [vista, setVista] = useState<VistaBaja | null>(null);
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const refForm = useDesplazarAlAbrir(vista, true);

  useEffect(() => {
    vistaBaja().then(setVista).catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar."));
  }, []);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await darmeDeBaja(pin);
      onHecha();
      setSesion(null);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const r = err?.extras["intentos_restantes"];
      toast.error(err?.message ?? "No se pudo completar la baja.", {
        description: typeof r === "number" ? `Te quedan ${r} intentos.` : undefined,
      });
      setPin("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Darme de baja</h1>
        {!vista ? (
          <Cargando />
        ) : (
          <section ref={refForm} className="rounded-2xl bg-card p-5 ring-1 ring-destructive/40">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <TriangleAlert className="size-5" /> Al darte de baja de {vista.negocio.nombre_comercial} pierdes:
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-destructive">
              <li>Saldo: {pesos(vista.saldo_centavos)}</li>
              {vista.tarjetas.map((t) => (
                <li key={t.tarjeta}>
                  {t.tarjeta}: {plural(t.sellos_en_curso, "sello", "sellos")} y {plural(t.premios_por_canjear, "premio", "premios")}
                </li>
              ))}
              {vista.reclamaciones_pendientes > 0 && <li>{plural(vista.reclamaciones_pendientes, "reclamación pendiente", "reclamaciones pendientes")}</li>}
              {vista.referidos_pendientes > 0 && <li>{plural(vista.referidos_pendientes, "recomendación pendiente", "recomendaciones pendientes")}</li>}
              {vista.cuenta_se_elimina && <li>Tu cuenta de MiSaldo se elimina por completo.</li>}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">Es inmediato y no se puede deshacer. Escribe tu PIN para confirmar.</p>
            <Input
              className="mt-2 h-12 text-center font-mono text-xl tracking-[0.4em]"
              type="password"
              inputMode="numeric"
              maxLength={128}
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <Button variant="destructive" size="lg" className="mt-4 w-full" disabled={pin.length < 4 || enviando} onClick={() => void confirmar()}>
              {enviando ? "Procesando…" : "Sí, darme de baja y perder mi saldo"}
            </Button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
