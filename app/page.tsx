"use client";

// Dev-only landing. On Vercel the Next.js app is excluded (see .vercelignore)
// and public/index.html is served directly at /. This page exists so that
// `next dev` doesn't 404 at the root while you're iterating on /office.
export default function DevLanding() {
  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e8e8ea",
    fontFamily: "'Share Tech Mono', monospace",
    padding: "60px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    alignItems: "flex-start",
  };
  const link: React.CSSProperties = {
    color: "#ff7a00",
    textDecoration: "none",
    borderBottom: "1px dashed #ff7a00",
    padding: "2px 0",
  };
  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
        DJ TITAN — dev server
      </h1>
      <p>
        The DJ studio UI is a static file. Open{" "}
        <a href="/index.html" style={link}>/index.html</a> directly.
      </p>
      <p>
        Admin panel: <a href="/office" style={link}>/office</a>
      </p>
      <p style={{ fontSize: 12, color: "#888" }}>
        Production (Vercel) ignores this page and serves public/index.html at /.
      </p>
    </main>
  );
}
