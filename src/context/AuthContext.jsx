import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const TOKEN_KEY = "tobbihub_token";
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);

  // Auto-fetch current user if a token exists on load
  useEffect(() => {
    const fetchMe = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUser(res.data);
        setToken(storedToken);
      } catch (err) {
        // Invalid/expired token — clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const persistAuth = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      avatar: data.avatar,
      role: data.role,
    });
    return data;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
    return persistAuth(res.data);
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      name,
      email,
      password,
    });
    return persistAuth(res.data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
