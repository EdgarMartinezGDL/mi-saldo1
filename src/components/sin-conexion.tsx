import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { leerCopia, type CopiaSinConexion } from "@/lib/sin-conexion-storage";
import { instante } from "@/lib/api/formato";
import { plural } from "@/lib/plural";

export function PantallaSinConexion() {
  const { sesion, reintentar } = useAuth();
  const [copia, setCopia] = useState<CopiaSinConexion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setCopia(!sesion || sesion.contexto.rol === "cliente" ? leerCopia() : null); }, [sesion]);
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card px-4 py-4"><p className="font-semibold">MiSaldo · By MicroFix Cloud</p></header>
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
      {copia ? <>
        <div role="status"><p className="font-medium text-warn">Sin conexión. Mostramos lo último que guardamos en este teléfono.</p>
          <p className="mt-1 text-sm text-muted-foreground">Actualizado el {instante(copia.actualizado_en)}</p></div>
        <h1 className="text-2xl font-semibold">{copia.nombre}</h1>
        <section className="rounded-xl bg-secondary p-4">
          <h2 className="text-sm font-medium">Código de acumulación</h2>
          {copia.codigo_acumulacion ? <><p className="mt-2 font-mono text-5xl font-bold tabular-nums">{copia.codigo_acumulacion}</p>
            <p className="mt-2 text-sm text-muted-foreground">Díctalo en caja para sumar saldo o sellos.</p></> :
            <p className="mt-2 text-sm text-muted-foreground">Abre «Mis códigos» con conexión para guardarlo en este teléfono.</p>}
        </section>
        {copia.negocios.map((n) => <article key={n.negocio_id} className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold">{n.nombre_comercial}</h2>
          {n.saldo_centavos !== null && <p className="mt-2 font-mono text-2xl">{new Intl.NumberFormat("es-MX", { minimumFractionDigits: n.decimales, maximumFractionDigits: n.decimales }).format(n.saldo_centavos / 10 ** n.decimales)} {n.moneda}</p>}
          {n.tarjetas.map((t, i) => <div key={i} className="mt-3 border-t border-border pt-3"><p className="font-medium">{t.nombre}</p>
            <p className="text-sm text-muted-foreground">{t.sellos_actuales}/{t.sellos_requeridos} sellos · {plural(t.premios_por_canjear, "premio listo", "premios listos")}</p></div>)}
        </article>)}
        <p className="text-sm text-muted-foreground">Tu código de canje nunca se guarda en el teléfono. Si lo olvidaste, cámbialo cuando tengas conexión.</p>
      </> : <p role="status">Sin conexión. Conéctate a internet para entrar.</p>}
      <Button size="lg" disabled={ocupado} onClick={async () => { setOcupado(true); try { await reintentar(); } finally { setOcupado(false); } }}>Reintentar</Button>
    </main>
  </div>;
}

export function ConexionContenido({ children }: { children: ReactNode }) {
  const { estado, sesion, conectado } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (estado === "sin_conexion") return <PantallaSinConexion />;
  return <>
    {sesion && !conectado && <div role="status" className="sticky top-0 z-50 bg-warn px-4 py-2 text-center text-sm font-medium text-background">
      <p>Sin conexión: los datos pueden no estar actualizados.</p>
      {pathname === "/caja" && <p>La caja necesita internet para operar.</p>}
    </div>}
    {children}
  </>;
}