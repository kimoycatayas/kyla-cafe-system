"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { useAuth } from "@/components/auth/AuthSessionBoundary";
import {
  fetchUsers,
  updateUserRole,
  type User,
  type UserRole,
} from "@/lib/userClient";

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: "CASHIER", label: "Cashier", color: "bg-slate-100 text-slate-700" },
  { value: "MANAGER", label: "Manager", color: "bg-blue-100 text-blue-700" },
  { value: "ADMIN", label: "Admin", color: "bg-purple-100 text-purple-700" },
  {
    value: "SUPER_ADMIN",
    label: "Super Admin",
    color: "bg-amber-100 text-amber-700",
  },
];

const getRoleBadgeColor = (role: UserRole): string => {
  return (
    ROLE_OPTIONS.find((r) => r.value === role)?.color ??
    "bg-slate-100 text-slate-700"
  );
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userList = await fetchUsers();
      setUsers(userList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      void loadUsers();
    }
  }, [isSuperAdmin, loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.profile?.businessName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(
            `Change ${user.name || user.email}'s role to ${
              ROLE_OPTIONS.find((r) => r.value === newRole)?.label ?? newRole
            }?`
          )
        : true;

    if (!confirmed) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);
    setFeedback(null);

    try {
      const updatedUser = await updateUserRole(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
      setFeedback(
        `${user.name || user.email}'s role updated to ${
          ROLE_OPTIONS.find((r) => r.value === newRole)?.label ?? newRole
        }.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user role. Please try again."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <RoleProtectedRoute>
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
              <Logo
                href="/dashboard"
                size={36}
                textClassName="text-lg font-semibold text-slate-900"
                imageClassName="h-9 w-auto"
              />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-6 py-12">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <h2 className="text-xl font-semibold text-rose-900">
                Access Denied
              </h2>
              <p className="mt-2 text-sm text-rose-700">
                Only super administrators can access user management.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Return to Dashboard
              </Link>
            </div>
          </main>
        </div>
      </RoleProtectedRoute>
    );
  }

  return (
    <RoleProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center gap-4">
              <Logo
                href="/dashboard"
                size={36}
                textClassName="text-lg font-semibold text-slate-900"
                imageClassName="h-9 w-auto"
                className="shrink-0"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
                  User Management
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Manage User Roles
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  View and update user roles across your organization.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6 py-12">
          {error && (
            <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {feedback && (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by name, email, or business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="min-w-[150px]">
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as UserRole | "ALL")
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="ALL">All Roles</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-slate-600">
              {filteredUsers.length}{" "}
              {filteredUsers.length === 1 ? "user" : "users"}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">
                {users.length === 0
                  ? "No users found."
                  : "No users match your search criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Current Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Change Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {user.name || "No name"}
                          </p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {user.profile?.businessName || "—"}
                        </p>
                        {user.profile?.industry && (
                          <p className="text-xs text-slate-500">
                            {user.profile.industry}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {ROLE_OPTIONS.find((r) => r.value === user.role)
                            ?.label ?? user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(
                              user.id,
                              e.target.value as UserRole
                            )
                          }
                          disabled={
                            updatingUserId === user.id ||
                            user.id === currentUser?.id
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {user.id === currentUser?.id && (
                          <p className="mt-1 text-xs text-slate-500">
                            (Your account)
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-500">
                          {new Date(user.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </RoleProtectedRoute>
  );
}
