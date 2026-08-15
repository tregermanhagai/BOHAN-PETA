import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CohortResponse,
  QuizAssignmentResponse,
  QuizTemplateSummaryResponse,
} from "@bohan-peta/shared-types";
import { api, ApiError } from "../../lib/api-client";

export function CohortDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cohort, setCohort] = useState<CohortResponse | null>(null);
  const [assignments, setAssignments] = useState<QuizAssignmentResponse[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizTemplateSummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffle, setShuffle] = useState(true);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");

  async function load() {
    if (!id) return;
    const [cohortData, assignmentData, quizData] = await Promise.all([
      api.get<CohortResponse>(`/cohorts/${id}`),
      api.get<QuizAssignmentResponse[]>(`/cohorts/${id}/assignments`),
      api.get<QuizTemplateSummaryResponse[]>("/quiz-templates"),
    ]);
    setCohort(cohortData);
    setAssignments(assignmentData);
    setQuizzes(quizData);
    if (!selectedQuizId && quizData.length > 0) setSelectedQuizId(quizData[0].id);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Could not load cohort"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onCreateAssignment(e: FormEvent) {
    e.preventDefault();
    if (!id || !selectedQuizId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/cohorts/${id}/assignments`, {
        quizTemplateId: selectedQuizId,
        openAt: openAt || null,
        closeAt: closeAt || null,
        maxAttempts,
        shuffle,
      });
      setOpenAt("");
      setCloseAt("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create assignment");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteCohort() {
    if (!id || !cohort) return;
    if (!confirm(t("cohorts.deleteConfirm", { name: cohort.name }))) return;
    try {
      await api.delete(`/cohorts/${id}`);
      navigate("/cohorts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete cohort");
    }
  }

  async function onDeleteAssignment(assignment: QuizAssignmentResponse) {
    if (!id) return;
    if (!confirm(t("assignments.deleteConfirm", { quiz: assignment.quizTemplateTitle }))) return;
    try {
      await api.delete(`/cohorts/${id}/assignments/${assignment.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete assignment");
    }
  }

  const selectedQuiz = useMemo(
    () => quizzes?.find((q) => q.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );

  if (!cohort) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page page-wide">
      <Link className="back-link" to="/cohorts">
        {t("cohorts.backToList")}
      </Link>
      <div className="page-head">
        <h1>{cohort.name}</h1>
        <div className="form-actions">
          <Link className="secondary" to={`/cohorts/${id}/scores`}>
            {t("scores.title")}
          </Link>
          <button className="link danger" type="button" onClick={onDeleteCohort}>
            {t("cohorts.delete")}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t("assignments.create")}</h2>
        {quizzes !== null && quizzes.length === 0 ? (
          <p className="muted">{t("assignments.noQuizzes")}</p>
        ) : (
          <form onSubmit={onCreateAssignment}>
            {error && <div className="error">{error}</div>}
            <div className="field">
              <label htmlFor="assignment-quiz">{t("assignments.quiz")}</label>
              <select
                id="assignment-quiz"
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
              >
                {quizzes?.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} — {t(`quizzes.status.${q.status}`)}
                  </option>
                ))}
              </select>
              {selectedQuiz && (
                <span className="muted">
                  {t("assignments.quizDuration", { minutes: selectedQuiz.durationMinutes })}{" "}
                  <Link to={`/quizzes/${selectedQuiz.id}`}>{t("assignments.quizDurationEdit")}</Link>
                </span>
              )}
            </div>
            <div className="settings-grid">
              <div className="field">
                <label htmlFor="openAt">{t("assignments.openAt")}</label>
                <input
                  id="openAt"
                  type="datetime-local"
                  value={openAt}
                  onChange={(e) => setOpenAt(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="closeAt">{t("assignments.closeAt")}</label>
                <input
                  id="closeAt"
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="maxAttempts">{t("assignments.maxAttempts")}</label>
              <input
                id="maxAttempts"
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
            </div>
            <div className="checkbox-row">
              <input
                id="shuffle"
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              <label htmlFor="shuffle">{t("assignments.shuffle")}</label>
            </div>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? t("common.loading") : t("assignments.create")}
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>{t("assignments.title")}</h2>
        {assignments === null && <p className="muted">{t("common.loading")}</p>}
        {assignments !== null && assignments.length === 0 && <p className="muted">{t("assignments.empty")}</p>}
        {assignments?.map((a) => {
          const quiz = quizzes?.find((q) => q.id === a.quizTemplateId);
          return (
          <div className="list-row" key={a.id}>
            <div>
              <div className="list-row-title">
                <Link to={`/quizzes/${a.quizTemplateId}`}>{a.quizTemplateTitle}</Link>
              </div>
              <div className="list-row-meta">
                {a.openAt ?? "—"} – {a.closeAt ?? "—"} · {t("assignments.maxAttempts")}: {a.maxAttempts}
                {quiz && <> · {t("assignments.quizDuration", { minutes: quiz.durationMinutes })}</>}
              </div>
            </div>
            <div>
              <div className="access-code">{a.accessCode}</div>
              <div className="list-row-meta">{t("assignments.accessCodeHint")}</div>
            </div>
            <button className="link danger" type="button" onClick={() => onDeleteAssignment(a)}>
              {t("common.delete")}
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
