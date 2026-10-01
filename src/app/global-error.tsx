"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>حدث خطأ · Something went wrong</h1>
          <p style={{ color: "#6e6c66", fontSize: 14 }}>أعد تحميل الصفحة · Please reload the page.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 12, border: 0, background: "#0b0b0b", color: "#fff", cursor: "pointer" }}>
            إعادة التحميل · Reload
          </button>
        </div>
      </body>
    </html>
  );
}
