import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import type { AttemptReviewResponse } from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

export function ReviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<AttemptReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<AttemptReviewResponse>(`/attempts/${id}/review`, { auth: false })
      .then(setReview)
      .catch((err) => setError(translateApiError(err, t)));
  }, [id]);

  if (error) return <div className="page error">{error}</div>;
  if (!review) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page">
      <h1>{t("review.title")}</h1>
      <div className="card">
        <span className={`result-badge ${review.passed ? "pass" : "fail"}`}>
          {review.passed ? t("result.pass") : t("result.fail")}
        </span>
        <div className="result-score">{Math.round(review.score)}%</div>
        <p dir="auto">{review.feedbackText}</p>
      </div>

      {review.questions.map((q, i) => (
        <div className={`review-question ${q.correct ? "correct" : "incorrect"}`} key={q.id}>
          <span className={`review-status ${q.correct ? "correct" : "incorrect"}`}>
            {i + 1}.{" "}
            {q.type === "open"
              ? t("review.pointsEarned", { earned: q.pointsEarned, points: q.points })
              : q.correct
                ? t("review.correct")
                : t("review.incorrect")}
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
            </div>
          ) : (
            <ul className="option-list">
              {q.options.map((opt) => {
                const selected = q.selectedOptionIds.includes(opt.id);
                const showCorrect = opt.isCorrect !== undefined;
                return (
                  <li
                    key={opt.id}
                    className={`review-option ${selected ? "selected" : ""} ${showCorrect && opt.isCorrect ? "correct-answer" : ""}`}
                    dir="auto"
                  >
                    {selected ? "☑" : "☐"} {opt.text}
                    {selected && ` — ${t("review.yourAnswer")}`}
                    {showCorrect && opt.isCorrect && !selected && ` — ${t("review.correctAnswer")}`}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
