import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { TopBar } from "./components/TopBar";
import { Footer } from "./components/Footer";
import { AccessibilityPage } from "./routes/AccessibilityPage";
import { LoginPage } from "./routes/teacher/LoginPage";
import { RegisterPage } from "./routes/teacher/RegisterPage";
import { CohortsPage } from "./routes/teacher/CohortsPage";
import { CohortDetailPage } from "./routes/teacher/CohortDetailPage";
import { ScoresPage } from "./routes/teacher/ScoresPage";
import { QuizzesPage } from "./routes/teacher/QuizzesPage";
import { QuizEditorPage } from "./routes/teacher/QuizEditorPage";
import { AttemptGradingPage } from "./routes/teacher/AttemptGradingPage";
import { JoinPage } from "./routes/student/JoinPage";
import { ExamPage } from "./routes/student/ExamPage";
import { ResultPage } from "./routes/student/ResultPage";
import { ReviewPage } from "./routes/student/ReviewPage";

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
        <Route path="/" element={<Navigate to={isAuthenticated ? "/cohorts" : "/join"} replace />} />
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
          path="/cohorts/:id/scores"
          element={
            <RequireAuth>
              <ScoresPage />
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
        <Route
          path="/attempts/:id/grading"
          element={
            <RequireAuth>
              <AttemptGradingPage />
            </RequireAuth>
          }
        />

        {/* Student flow — public, no auth (PRD 3.1). */}
        <Route path="/join" element={<JoinPage />} />
        <Route path="/attempt/:id" element={<ExamPage />} />
        <Route path="/attempt/:id/result" element={<ResultPage />} />
        <Route path="/review/:id" element={<ReviewPage />} />

        <Route path="/accessibility" element={<AccessibilityPage />} />
      </Routes>
      <Footer />
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
