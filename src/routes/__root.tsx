import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ClientOnly,
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { MiSaldoProvider } from "@/components/misaldo-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { TotpProvider } from "@/components/totp-provider";
import { roleHome } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TecladoVisible } from "@/lib/teclado-visible";
import { ConexionContenido } from "@/components/sin-conexion";
import { registrarWorker } from "@/lib/pwa-registro";

/** Card shell shared by the 404 and error boundaries: app styling, no AppShell chrome. */
function TarjetaEstado({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="shadow-soft w-full max-w-sm rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-border sm:px-8">
        <p className="font-mono text-lg font-bold tracking-tight text-primary">MiSaldo</p>
        {children}
      </div>
    </div>
  );
}

/** "Ir al inicio" that follows the real session: role home when signed in, /login otherwise. */
function BotonInicio() {
  const { estado, sesion } = useAuth();
  if (estado === "comprobando") {
    return (
      <Button size="lg" disabled>
        Cargando…
      </Button>
    );
  }
  const to = sesion ? roleHome(sesion.contexto.rol) : "/login";
  return (
    <Button size="lg" asChild>
      <Link to={to}>Ir al inicio</Link>
    </Button>
  );
}

function NotFoundComponent() {
  useEffect(() => {
    document.title = "Página no encontrada · MiSaldo";
  }, []);

  return (
    <TarjetaEstado>
      <h1 className="mt-4 text-6xl font-bold tracking-tight text-foreground">404</h1>
      <h2 className="mt-3 text-xl font-semibold text-foreground">Página no encontrada</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        La página que buscas no existe o cambió de dirección.
      </p>
      <div className="mt-8">
        <BotonInicio />
      </div>
    </TarjetaEstado>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <TarjetaEstado>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        Esta página no cargó
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ocurrió un problema. Intenta recargar o vuelve al inicio.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Intentar de nuevo
        </Button>
        <BotonInicio />
      </div>
    </TarjetaEstado>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: "MiSaldo · Lealtad para tu negocio" },
      {
        name: "description",
        content: "Saldo, sellos y recompensas de tus negocios favoritos, en tu celular.",
      },
      { name: "theme-color", content: "#0b7a5e" },
      { property: "og:title", content: "MiSaldo · Lealtad para tu negocio" },
      {
        property: "og:description",
        content: "Saldo, sellos y recompensas de tus negocios favoritos, en tu celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => registrarWorker(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <MiSaldoProvider>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <TotpProvider>
            <ConexionContenido><ClientOnly><Outlet /></ClientOnly></ConexionContenido>
          </TotpProvider>
          <Toaster position="top-center" />
          <TecladoVisible />
        </AuthProvider>
      </MiSaldoProvider>
    </QueryClientProvider>
  );
}
