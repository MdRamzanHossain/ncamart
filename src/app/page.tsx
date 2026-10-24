export default function HomePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>NCAMart Backend API</h1>
      <p>Backend-first infrastructure active. API routes available at <code>/api/v1/*</code>.</p>
      <p>Health check: <a href="/api/v1/health"><code>/api/v1/health</code></a></p>
    </main>
  );
}
