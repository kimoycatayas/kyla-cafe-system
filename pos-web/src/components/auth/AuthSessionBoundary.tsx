"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { login, toAuthPayload } from "@/lib/authClient";
import { authStorage, AUTH_CHANGE_EVENT } from "@/lib/authStorage";
import { setUnauthorizedHandler } from "@/lib/authEvents";

type StoredUser = NonNullable<ReturnType<typeof authStorage.getUser>>;

type AuthContextValue = {
  user: StoredUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

type AuthSessionBoundaryProps = {
  children: ReactNode;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthSessionBoundary");
  }
  return context;
};

export function AuthSessionBoundary({ children }: AuthSessionBoundaryProps) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(() => authStorage.getUser());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const deferredRef = useRef<Deferred | null>(null);

  const ensureDeferred = useCallback((): Promise<void> => {
    if (!deferredRef.current) {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      deferredRef.current = { promise, resolve, reject };
    }
    return deferredRef.current.promise;
  }, []);

  const openModal = useCallback((): Promise<void> => {
    const currentUser = authStorage.getUser();
    setEmail(currentUser?.email ?? "");
    setPassword("");
    setError(null);
    setIsModalOpen(true);
    return ensureDeferred();
  }, [ensureDeferred]);

  useEffect(() => {
    setUnauthorizedHandler(() => openModal());

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [openModal]);

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(authStorage.getUser());
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    return () => {
      window.removeEventListener(
        AUTH_CHANGE_EVENT,
        handleAuthChange as EventListener,
      );
    };
  }, []);

  const handleSuccess = useCallback(() => {
    if (deferredRef.current) {
      deferredRef.current.resolve();
      deferredRef.current = null;
    }
    setIsModalOpen(false);
    setError(null);
  }, []);

  const handleFailure = useCallback((reason: string) => {
    if (deferredRef.current) {
      deferredRef.current.reject(new Error(reason));
      deferredRef.current = null;
    }
    setIsModalOpen(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login({ email, password });
      authStorage.save(toAuthPayload(response));
      setUser(response.user);
      handleSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    authStorage.clear();
    setUser(null);
    handleFailure("Re-authentication cancelled");
    router.replace("/login");
  };

  const contextValue = useMemo<AuthContextValue>(() => ({ user }), [user]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              Session expired
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your access token is no longer valid. Please sign in again to
              continue working without losing your progress.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="grid gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="you@cafesystem.ph"
                  required
                  autoFocus
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="Enter your password"
                  required
                />
              </label>

              {error ? (
                <p className="text-sm font-medium text-rose-600">{error}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Signing in…" : "Sign back in"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}
