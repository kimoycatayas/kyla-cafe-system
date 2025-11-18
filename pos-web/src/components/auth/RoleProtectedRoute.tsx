"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { authStorage } from "@/lib/authStorage";

type RoleProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
  fallbackPath?: string;
  loading?: ReactNode;
};

/**
 * Protects routes based on user role.
 * If user is a cashier, they can only access /sales-processing.
 * Other roles can access all pages.
 */
export function RoleProtectedRoute({
  children,
  allowedRoles,
  fallbackPath = "/login",
  loading,
}: RoleProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = authStorage.getAccessToken();
    const user = authStorage.getUser();

    let shouldAuthorize = true;
    let redirectPath: string | null = null;

    if (!token) {
      shouldAuthorize = false;
      redirectPath = fallbackPath;
    } else if (user?.role === "CASHIER") {
      // Cashiers can only access sales-processing page
      if (pathname !== "/sales-processing") {
        shouldAuthorize = false;
        redirectPath = "/sales-processing";
      }
    } else if (allowedRoles && user?.role) {
      // For other roles, check if they have the required role
      if (!allowedRoles.includes(user.role)) {
        shouldAuthorize = false;
        redirectPath = fallbackPath;
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthorized(shouldAuthorize);

    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [pathname, allowedRoles, fallbackPath, router]);

  if (isAuthorized === null) {
    return (
      loading ?? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Checking access...
        </div>
      )
    );
  }

  if (!isAuthorized) {
    return (
      loading ?? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Redirecting...
        </div>
      )
    );
  }

  return <>{children}</>;
}
