"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const AdminPanel = lazy(() => import("./panel"));

function LoadingPanel() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07111f", color: "#e2e8f0" }}>
      <div role="status" aria-live="polite">Yönetim paneli yükleniyor…</div>
    </main>
  );
}

export default function AdminClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keep the large dashboard out of Worker SSR; authorization stays on the server.
  if (!mounted) return <LoadingPanel />;
  return <Suspense fallback={<LoadingPanel />}><AdminPanel /></Suspense>;
}
