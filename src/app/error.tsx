"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-[#00895B]">Menoska Consulting</p>
      <h1 className="font-display text-2xl font-bold text-[#394A51]">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <p className="text-sm text-muted-foreground">{error.message || "Error inesperado en la aplicación."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[#00895B] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Reintentar / Retry
      </button>
    </div>
  );
}
