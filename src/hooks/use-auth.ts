import { useState } from "react";
import { getToken } from "@/integrations/api";

// Lightweight auth hook: reads token synchronously from localStorage so
// ProtectedRoute can check authentication immediately on mount.
export function useAuth() {
  // Initialize from localStorage synchronously to avoid a false negative
  // during the first render (which caused immediate redirects back to /login).
  const [token, setToken] = useState<string | null>(() => getToken());

  const isAuthenticated = !!token;

  function logout() {
    localStorage.removeItem("jwt_token");
    setToken(null);
  }

  return { token, isAuthenticated, logout };
}
