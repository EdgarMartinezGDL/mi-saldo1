import { LoaderCircle } from "lucide-react";

export function ExternalEntryLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-soft ring-1 ring-border">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">Cargando...</h1>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </section>
    </main>
  );
}