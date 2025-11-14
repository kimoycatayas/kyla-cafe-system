"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authStorage } from "@/lib/authStorage";

type ProtectedRouteProps = {
  children: ReactNode;
  fallbackPath?: string;
  loading?: ReactNode;
};

export function ProtectedRoute({
  children,
  fallbackPath = "/login",
  loading,
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized] = useState<boolean>(() => {
    const token = authStorage.getAccessToken();
    return Boolean(token);
  });

  useEffect(() => {
    if (!isAuthorized) {
      router.replace(fallbackPath);
    }
  }, [fallbackPath, isAuthorized, router]);

  if (!isAuthorized) {
    return (
      loading ?? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Checking access...
        </div>
      )
    );
  }

  return <>{children}</>;
}
