import { createContext, useContext, useEffect, useState } from "react";
import api from "@/api";

const AuthContext = createContext(null);

const GUEST_KEY = "arena_guest_mode";
const GUEST_USER = { id: "guest", email: "guest@public", name: "Guest", role: "guest" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = anonymous
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        // Fallback to previously-chosen guest mode
        if (typeof window !== "undefined" && localStorage.getItem(GUEST_KEY) === "1") {
          setUser(GUEST_USER);
        } else {
          setUser(false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.removeItem(GUEST_KEY);
    setUser(data);
    return data;
  };

  const enterGuestMode = () => {
    localStorage.setItem(GUEST_KEY, "1");
    setUser(GUEST_USER);
    return GUEST_USER;
  };

  const logout = async () => {
    const wasGuest = user?.role === "guest";
    if (!wasGuest) {
      try {
        await api.post("/auth/logout");
      } catch (err) {
        console.warn("Logout request failed:", err?.message);
      }
    }
    localStorage.removeItem(GUEST_KEY);
    setUser(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        enterGuestMode,
        logout,
        setUser,
        isAdmin: user?.role === "admin",
        isGuest: user?.role === "guest",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
