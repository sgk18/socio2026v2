"use client";

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";

const ALLOWED_DOMAIN = "christuniversity.in";

function ErrorContent() {
  const { signInWithGoogle, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const errorReason = searchParams.get("error");

  const config = useMemo(() => {
    switch (errorReason) {
      case "invalid_domain":
        return {
          code: "401",
          bigLabel: "Wrong door.",
          description: `SOCIO only works with @${ALLOWED_DOMAIN} accounts. Pick the right Google account and try again.`,
          showTryAgain: true,
          actionLabel: "Try Again",
        };
      case "not_authorized":
        return {
          code: "403",
          bigLabel: "Not on the list.",
          description:
            "This area is restricted to users with a specific role. Your student account works perfectly everywhere else on SOCIO.",
          showTryAgain: false,
          actionLabel: "Go to Discover",
        };
      default:
        return {
          code: "404",
          bigLabel: "Page not found.",
          description:
            "The page you're looking for doesn't exist or has been moved. Head back and keep exploring.",
          showTryAgain: false,
          actionLabel: "Go to Discover",
        };
    }
  }, [errorReason]);

  const handleAction = () => {
    if (config.showTryAgain) {
      signInWithGoogle();
    } else {
      window.location.href = "/Discover";
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-[#f6f6f6]"
      style={{ height: "calc(100dvh - 80px)" }}
    >
      {/* Side code labels — left and right mid */}
      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-300 select-none tracking-widest rotate-0">
        {config.code}
      </span>
      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-300 select-none tracking-widest">
        {config.code}
      </span>

      {/* Center link */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
        <Link
          href="/Discover"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors tracking-wide"
        >
          back to home
        </Link>
      </div>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 pl-6 pr-24 sm:pr-28 pb-7 flex items-end justify-between gap-6">
        {/* Big code + description */}
        <div className="flex items-end gap-4 max-w-[60%]">
          <span className="text-7xl sm:text-[6rem] font-black italic leading-none text-[#154CB3] shrink-0 select-none">
            {config.code}
          </span>
          <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed pb-1 max-w-[220px] font-medium">
            {config.description}
          </p>
        </div>

        {/* Compound button */}
        <div className="shrink-0 flex items-stretch rounded-xl overflow-hidden shadow-sm border border-gray-200">
          <div className="bg-[#063168] flex items-center justify-center px-4 py-3">
            <Image
              src={Logo}
              alt="SOCIO"
              width={20}
              height={20}
              className="brightness-0 invert w-5 h-5 object-contain"
            />
          </div>
          <button
            onClick={handleAction}
            disabled={config.showTryAgain && isLoading}
            className="bg-[#FFCC00] text-[#063168] px-5 py-3 text-sm font-semibold hover:bg-[#f0c000] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {config.showTryAgain && isLoading ? "Loading..." : config.actionLabel}
          </button>
        </div>
      </div>

      {/* Bottom corner codes */}
      <span className="absolute bottom-5 left-5 text-xs font-mono text-gray-200 select-none">
        {config.code}
      </span>
      <span className="absolute bottom-5 right-5 text-xs font-mono text-gray-200 select-none">
        {config.code}
      </span>
    </div>
  );
}

function ErrorFallback() {
  return (
    <div
      className="relative w-full bg-[#f6f6f6] flex items-center justify-center"
      style={{ height: "calc(100dvh - 80px)" }}
    >
      <div className="w-8 h-8 rounded-full border-4 border-[#154CB3]/20 border-t-[#154CB3] animate-spin" />
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <ErrorContent />
    </Suspense>
  );
}
