import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for the owner's admin center: the hub is negocio.index.tsx, each section is its own child route. */
export const Route = createFileRoute("/negocio")({
  component: () => <Outlet />,
});
