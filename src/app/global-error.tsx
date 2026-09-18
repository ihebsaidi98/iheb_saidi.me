"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#04070c", color: "#fff", display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "monospace" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem" }}>Critical failure</h1>
          <p style={{ opacity: 0.6 }}>The root layout itself crashed.</p>
          <button
            onClick={reset}
            style={{ marginTop: "1.5rem", padding: "0.75rem 1.5rem", borderRadius: 9999, border: "1px solid rgba(110,231,183,.4)", background: "transparent", color: "#fff", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}