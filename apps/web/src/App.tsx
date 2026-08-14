import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { TopBar } from "./components/TopBar";
import { LoginPage } from "./routes/teacher/LoginPage";
import { RegisterPage } from "./routes/teacher/RegisterPage";
import { CohortsPage } from "./routes/teacher/CohortsPage";
import { CohortDetailPage } from "./routes/teacher/CohortDetailPage";
import { QuizzesPage } from "./routes/teacher/QuizzesPage";
import { QuizEditorPage } from "./routes/teacher/QuizEditorPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/cohorts" : "/login"} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/cohorts"
          element={
            <RequireAuth>
              <CohortsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/cohorts/:id"
          element={
            <RequireAuth>
              <CohortDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quizzes"
          element={
            <RequireAuth>
              <QuizzesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quizzes/:id"
          element={
            <RequireAuth>
              <QuizEditorPage />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
