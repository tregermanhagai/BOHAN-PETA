import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { QuizTemplateSummaryResponse } from "@bohan-peta/shared-types";
import { api, ApiError } from "../../lib/api-client";

export function QuizzesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizTemplateSummaryResponse[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const data = await api.get<QuizTemplateSummaryResponse[]>("/quiz-templates");
      setQuizzes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load quizzes");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string }>("/quiz-templates", { title });
      navigate(`/quizzes/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create quiz");
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>{t("quizzes.title")}</h1>

      <div className="card">
        <form onSubmit={onCreate}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="quiz-title">{t("quizzes.titleLabel")}</label>
            <input id="quiz-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("quizzes.create")}
          </button>
        </form>
      </div>

      <div className="card">
        {quizzes === null && <p className="muted">{t("common.loading")}</p>}
        {quizzes !== null && quizzes.length === 0 && <p className="muted">{t("quizzes.empty")}</p>}
        {quizzes !== null &&
          quizzes.map((q) => (
            <div className="list-row" key={q.id}>
              <div>
                <div className="list-row-title">
                  <a href={`/quizzes/${q.id}`} onClick={(e) => { e.preventDefault(); navigate(`/quizzes/${q.id}`); }}>
                    {q.title}
                  </a>{" "}
                  <span className={`pill ${q.status}`}>{t(`quizzes.status.${q.status}`)}</span>
                </div>
                <div className="list-row-meta">{t("quizzes.questionCount", { count: q.questionCount })}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
