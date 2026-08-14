import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthResponse, LoginRequest, RegisterTeacherRequest, Teacher } from "@bohan-peta/shared-types";
import { api, setToken, getToken } from "../lib/api-client";

const TEACHER_KEY = "bohan-peta-teacher";

interface AuthContextValue {
  teacher: Teacher | null;
  isAuthenticated: boolean;
  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterTeacherRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredTeacher(): Teacher | null {
  const raw = localStorage.getItem(TEACHER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Teacher;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(() => (getToken() ? loadStoredTeacher() : null));

  function persist(auth: AuthResponse) {
    setToken(auth.accessToken);
    localStorage.setItem(TEACHER_KEY, JSON.stringify(auth.teacher));
    setTeacher(auth.teacher);
  }

  async function login(req: LoginRequest) {
    const auth = await api.post<AuthResponse>("/auth/login", req, { auth: false });
    persist(auth);
  }

  async function register(req: RegisterTeacherRequest) {
    const auth = await api.post<AuthResponse>("/auth/register", req, { auth: false });
    persist(auth);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(TEACHER_KEY);
    setTeacher(null);
  }

  const value = useMemo(
    () => ({ teacher, isAuthenticated: !!teacher, login, register, logout }),
    [teacher],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
