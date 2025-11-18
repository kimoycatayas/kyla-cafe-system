"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { authStorage, AUTH_CHANGE_EVENT } from "@/lib/authStorage";

export function HeaderAuthButtons() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const updateAuthState = () => {
      setIsAuthenticated(Boolean(authStorage.getAccessToken()));
    };

    updateAuthState();

    window.addEventListener(AUTH_CHANGE_EVENT, updateAuthState as EventListener);
    return () => {
      window.removeEventListener(
        AUTH_CHANGE_EVENT,
        updateAuthState as EventListener,
      );
    };
  }, []);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
      <Link
        href="/login"
        className="rounded-full px-4 py-2 transition-colors hover:bg-slate-100"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-sky-600 px-4 py-2 text-white transition-colors hover:bg-sky-700"
      >
        Create account
      </Link>
    </div>
  );
}

