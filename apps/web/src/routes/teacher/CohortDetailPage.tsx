import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CohortResponse,
  QuizAssignmentResponse,
  QuizTemplateSummaryResponse,
} from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

const HOURS_48_MS = 48 * 60 * 60 * 1000;

/** Local (not UTC) time in the format <input type="datetime-local"> expects. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultOpenAt(): string {
  return toDatetimeLocalValue(new Date());
}

function defaultCloseAt(): string {
  return toDatetimeLocalValue(new Date(Date.now() + HOURS_48_MS));
}

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
  const [openAt, setOpenAt] = useState(defaultOpenAt);
  const [closeAt, setCloseAt] = useState(defaultCloseAt);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);

  async function onCopyAccessCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1500);
  }

  async function onCopyJoinUrl() {
    await navigator.clipboard.writeText(joinUrl);
    setCopiedJoinUrl(true);
    setTimeout(() => setCopiedJoinUrl(false), 1500);
  }

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
    const published = quizData.filter((q) => q.status === "published");
    if (!selectedQuizId && published.length > 0) setSelectedQuizId(published[0].id);
  }

  useEffect(() => {
    load().catch((err) => setError(translateApiError(err, t)));
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
        // <input type="datetime-local"> gives a naive string with no
        // timezone (e.g. "2026-08-22T13:38") — that's the browser's local
        // wall-clock time, but a server running in a different timezone
        // (e.g. UTC on Railway) would otherwise reparse the same naive
        // string as ITS OWN local time, shifting every open/close time by
        // the difference between the two. Converting to a real Date first
        // (parsed correctly as local time, since this code runs in the
        // browser) and serializing with toISOString() sends an
        // unambiguous UTC instant instead.
        openAt: openAt ? new Date(openAt).toISOString() : null,
        closeAt: closeAt ? new Date(closeAt).toISOString() : null,
        maxAttempts,
        shuffle,
      });
      setOpenAt(defaultOpenAt());
      setCloseAt(defaultCloseAt());
      await load();
    } catch (err) {
      setError(translateApiError(err, t));
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
      setError(translateApiError(err, t));
    }
  }

  async function onDeleteAssignment(assignment: QuizAssignmentResponse) {
    if (!id) return;
    if (!confirm(t("assignments.deleteConfirm", { quiz: assignment.quizTemplateTitle }))) return;
    try {
      await api.delete(`/cohorts/${id}/assignments/${assignment.id}`);
      await load();
    } catch (err) {
      setError(translateApiError(err, t));
    }
  }

  const selectedQuiz = useMemo(
    () => quizzes?.find((q) => q.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );
  // Draft quizzes are excluded here so a teacher can never assign an
  // unpublished quiz to a cohort — that's the only way to reach the
  // "not currently available" error a student would otherwise hit.
  const publishedQuizzes = useMemo(() => quizzes?.filter((q) => q.status === "published") ?? [], [quizzes]);
  // Same origin the teacher is viewing this page from, so it's the LAN IP
  // (not "localhost") when opened from a phone — matches how the API host
  // is auto-detected elsewhere (see README "Running on your phone").
  const joinUrl = `${window.location.origin}/join`;

  if (!cohort) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page page-wide">
      <Link className="back-link" to="/cohorts">
        {t("cohorts.backToList")}
      </Link>
      <div className="page-head">
        <h1>{cohort.name}</h1>
        <div className="form-actions">
          <Link className="primary" to={`/cohorts/${id}/scores`}>
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
        ) : quizzes !== null && publishedQuizzes.length === 0 ? (
          <p className="muted">{t("assignments.noPublishedQuizzes")}</p>
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
                {publishedQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
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
              <div className="list-row-title-row">
                <div className="list-row-title">
                  <Link to={`/quizzes/${a.quizTemplateId}`}>{a.quizTemplateTitle}</Link>
                </div>
                <button className="link danger" type="button" onClick={() => onDeleteAssignment(a)}>
                  {t("common.delete")}
                </button>
              </div>
              <div className="list-row-meta">
                {a.openAt ?? "—"} – {a.closeAt ?? "—"} · {t("assignments.maxAttempts")}: {a.maxAttempts}
                {quiz && <> · {t("assignments.quizDuration", { minutes: quiz.durationMinutes })}</>}
              </div>
            </div>
            <div>
              <div className="access-code-row">
                <div className="access-code">{a.accessCode}</div>
                <button className="link" type="button" onClick={() => onCopyAccessCode(a.accessCode)}>
                  {copiedCode === a.accessCode ? t("assignments.copied") : t("assignments.copyCode")}
                </button>
              </div>
              <div className="list-row-meta">{t("assignments.accessCodeHint")}</div>
              <div className="list-row-meta">{t("assignments.joinUrl")}:</div>
              <div className="join-url-row">
                <a className="join-url-link" href={joinUrl} target="_blank" rel="noreferrer">
                  {joinUrl}
                </a>
                <button className="link" type="button" onClick={onCopyJoinUrl}>
                  {copiedJoinUrl ? t("assignments.copied") : t("assignments.copyCode")}
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
