"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PopupSuccess() {
  useEffect(() => {
    const notifyParent = async () => {
      if (!window.opener || window.opener.closed) {
        window.close();
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.opener.postMessage(
            {
              type: "GOOGLE_AUTH_SUCCESS",
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            },
            window.location.origin
          );
        } else {
          window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, window.location.origin);
        }
      } catch {
        window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, window.location.origin);
      }

      setTimeout(() => window.close(), 100);
    };

    void notifyParent();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600 text-sm">Completing sign-in…</p>
    </div>
  );
}
