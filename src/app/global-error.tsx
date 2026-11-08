"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#f4f6f5", color: "#394A51" }}>
        <div style={{ maxWidth: 480, margin: "20vh auto", padding: 24, textAlign: "center" }}>
          <p style={{ color: "#00895B", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Menoska Consulting
          </p>
          <h1 style={{ fontSize: 28, margin: "12px 0" }}>Error crítico</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>A critical error occurred.</p>
          <p style={{ fontSize: 14, opacity: 0.8 }}>{error.message || "La aplicación no pudo cargarse."}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              background: "#00895B",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
