import { useState } from "react";
import { getToken } from "@/integrations/api";

// Lightweight auth hook: reads token synchronously from localStorage so
// ProtectedRoute can check authentication immediately on mount.
export function useAuth() {
  // Initialize from localStorage synchronously to avoid a false negative
  // during the first render (which caused immediate redirects back to /login).
  const [token, setToken] = useState<string | null>(() => getToken());

  const isAuthenticated = !!token;

  function getRole(): string | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const role = payload?.rol ?? payload?.role ?? null;
        return typeof role === 'string' ? role.toLowerCase() : null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  // Extract userId from JWT token
  function getUserId(): number | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const idClaim = payload?.id ?? payload?.sub ?? payload?.usuario_id ?? payload?.user_id ?? null;
        if (idClaim !== undefined && idClaim !== null) {
          const n = Number(idClaim);
          if (Number.isFinite(n)) return n;
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  function logout() {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_permissions");
    setToken(null);
  }

  const userId = getUserId();
  const role = getRole();

  return { token, isAuthenticated, logout, userId, role, isInfluencer: role === 'influencer' };
}

