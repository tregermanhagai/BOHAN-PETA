import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import type { AttemptReviewResponse } from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

export function AttemptGradingPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [review, setReview] = useState<AttemptReviewResponse | null>(null);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifyStudent, setNotifyStudent] = useState(false);
  const [notifySent, setNotifySent] = useState(false);

  function load() {
    if (!id) return;
    api
      .get<AttemptReviewResponse>(`/attempts/${id}/grading`)
      .then((data) => {
        setReview(data);
        setPoints(Object.fromEntries(data.questions.map((q) => [q.id, q.pointsEarned])));
        setTouched(new Set());
      })
      .catch((err) => setError(translateApiError(err, t)));
  }

  useEffect(load, [id]);

  function setQuestionPoints(questionId: string, value: number) {
    setPoints((prev) => ({ ...prev, [questionId]: value }));
    setTouched((prev) => new Set(prev).add(questionId));
  }

  function toggleCorrect(questionId: string, maxPoints: number, currentlyCorrect: boolean) {
    setQuestionPoints(questionId, currentlyCorrect ? 0 : maxPoints);
  }

  async function onSave() {
    if (!id || !review || touched.size === 0) return;
    setSaving(true);
    setError(null);
    setNotifySent(false);
    try {
      const overrides = Array.from(touched).map((questionId) => ({ questionId, points: points[questionId] }));
      const updated = await api.patch<AttemptReviewResponse>(`/attempts/${id}/grading`, {
        overrides,
        notifyStudent,
      });
      setReview(updated);
      setPoints(Object.fromEntries(updated.questions.map((q) => [q.id, q.pointsEarned])));
      setTouched(new Set());
      if (notifyStudent) setNotifySent(true);
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setSaving(false);
    }
  }

  if (error && !review) return <div className="page error">{error}</div>;
  if (!review) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page">
      <button className="back-link" type="button" onClick={() => navigate(-1)}>
        {t("grading.backToScores")}
      </button>
      <h1>{t("grading.title")}</h1>
      <div className="card">
        <span className={`result-badge ${review.passed ? "pass" : "fail"}`}>
          {review.passed ? t("result.pass") : t("result.fail")}
        </span>
        <div className="result-score">{Math.round(review.score)}%</div>
        {error && <div className="error">{error}</div>}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={notifyStudent}
            onChange={(e) => setNotifyStudent(e.target.checked)}
          />
          {t("grading.notifyStudent")}
        </label>
        <div className="form-actions">
          <button className="primary" type="button" onClick={onSave} disabled={saving || touched.size === 0}>
            {saving ? t("common.loading") : t("grading.save")}
          </button>
          {notifySent && <span className="muted">{t("grading.notifySent")}</span>}
        </div>
      </div>

      {review.questions.map((q, i) => {
        const currentPoints = points[q.id] ?? q.pointsEarned;
        const isCorrectNow = currentPoints === q.points;
        return (
          <div className={`review-question ${isCorrectNow ? "correct" : "incorrect"}`} key={q.id}>
            <span className={`review-status ${isCorrectNow ? "correct" : "incorrect"}`}>
              {i + 1}. {t("review.pointsEarned", { earned: currentPoints, points: q.points })}
              {q.overridePoints !== null && touched.has(q.id) === false && ` (${t("grading.overridden")})`}
            </span>
            <div className="question-text" dir="auto">
              {q.text}
            </div>

            {q.type === "open" ? (
              <div className="review-open-answer">
                <div className="muted">{t("review.yourAnswer")}</div>
                <p dir="auto">{q.answerText || "—"}</p>
                {q.aiFeedback != null && (
                  <>
                    <div className="muted">{t("review.aiFeedback")}</div>
                    <p dir="auto">{q.aiFeedback}</p>
                  </>
                )}
                <div className="field">
                  <label htmlFor={`points-${q.id}`}>{t("grading.pointsAwarded")}</label>
                  <input
                    id={`points-${q.id}`}
                    type="number"
                    min={0}
                    max={q.points}
                    value={currentPoints}
                    onChange={(e) => setQuestionPoints(q.id, Math.max(0, Math.min(q.points, Number(e.target.value))))}
                  />
                </div>
              </div>
            ) : (
              <>
                <ul className="option-list">
                  {q.options.map((opt) => {
                    const selected = q.selectedOptionIds.includes(opt.id);
                    return (
                      <li
                        key={opt.id}
                        className={opt.isCorrect ? "correct" : ""}
                        dir="auto"
                      >
                        {selected ? "☑" : "☐"} {opt.text}
                        {opt.isCorrect && ` — ${t("review.correctAnswer")}`}
                      </li>
                    );
                  })}
                </ul>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isCorrectNow}
                    onChange={() => toggleCorrect(q.id, q.points, isCorrectNow)}
                  />
                  {t("grading.markCorrect")}
                </label>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
