import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-provider";
import { SeccionMembresia } from "@/components/membresia";
import { SeccionNegocio } from "@/components/negocio/comun";

export const Route = createFileRoute("/negocio/membresia")({
  head: () => ({
    meta: [
      { title: "Membresía y pagos · MiSaldo" },
      { name: "description", content: "Estado de tu membresía de MiSaldo y métodos para pagar tu mensualidad." },
      { property: "og:title", content: "Membresía y pagos · MiSaldo" },
      { property: "og:description", content: "Revisa si te toca pagar y elige transferencia u OXXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Membresía y pagos">
      <SoloDueno />
    </SeccionNegocio>
  ),
});

function SoloDueno() {
  const { sesion } = useAuth();
  // Security: bank details render only for the real owner session.
  if (sesion?.contexto.rol !== "dueno") return null;
  return <SeccionMembresia />;
}
