"use client";

import { useEffect } from "react";

export default function PopupSuccess() {
  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, window.location.origin);
    }
    // Give the parent a tick to receive the message before closing
    const t = setTimeout(() => window.close(), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600 text-sm">Completing sign-in…</p>
    </div>
  );
}
