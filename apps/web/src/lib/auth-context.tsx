"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { PermissionAction, RoleName } from "@keyvantic/types";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  title?: string | null;
  avatarUrl?: string | null;
  role: RoleName;
  permissions: PermissionAction[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (action: PermissionAction) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      const me = await api.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ user: CurrentUser }>("/auth/login", { email, password });
      setUser(result.user);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasPermission = useCallback(
    (action: PermissionAction) => Boolean(user?.permissions.includes(action)),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isUnauthorized(err: unknown) {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
