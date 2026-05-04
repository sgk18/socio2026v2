"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PopupSuccess() {
  useEffect(() => {
    let unsubscribed = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const sendToParent = (type: "GOOGLE_AUTH_SUCCESS" | "GOOGLE_AUTH_ERROR", accessToken?: string, refreshToken?: string) => {
      if (unsubscribed) return;
      unsubscribed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (authSubscription) authSubscription.unsubscribe();

      if (!window.opener || window.opener.closed) {
        window.close();
        return;
      }

      window.opener.postMessage(
        type === "GOOGLE_AUTH_SUCCESS"
          ? { type, accessToken, refreshToken }
          : { type },
        window.location.origin
      );

      setTimeout(() => window.close(), 300);
    };

    const run = async () => {
      // Try immediately — session is often already available in cookies
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          sendToParent("GOOGLE_AUTH_SUCCESS", session.access_token, session.refresh_token);
          return;
        }
      } catch { /* fall through to listener */ }

      // Not available yet — wait for Supabase to fire SIGNED_IN / INITIAL_SESSION
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.access_token) {
          sendToParent("GOOGLE_AUTH_SUCCESS", session.access_token, session.refresh_token);
        }
      });
      authSubscription = subscription;

      // Give up after 8 s and tell parent so the spinner doesn't hang forever
      fallbackTimer = setTimeout(() => sendToParent("GOOGLE_AUTH_ERROR"), 8000);
    };

    void run();

    return () => {
      unsubscribed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600 text-sm">Completing sign-in…</p>
    </div>
  );
}
