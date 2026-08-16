import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  QuizDifficulty,
  QuizTemplateResponse,
  UpsertQuestionRequest,
} from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";
import { QuestionForm } from "../../components/QuestionForm";

export function QuizEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [quiz, setQuiz] = useState<QuizTemplateResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [gradingSaving, setGradingSaving] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  const [editingQuestionId, setEditingQuestionId] = useState<string | "new" | null>(null);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      const data = await api.get<QuizTemplateResponse>(`/quiz-templates/${id}`);
      setQuiz(data);
    } catch (err) {
      setLoadError(translateApiError(err, t));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadError) return <div className="page error">{loadError}</div>;
  if (!quiz) return <div className="page muted">{t("common.loading")}</div>;

  async function onSaveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quiz) return;
    const form = new FormData(e.currentTarget);
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      await api.patch(`/quiz-templates/${quiz.id}`, {
        title: String(form.get("title")),
        language: String(form.get("language")),
        difficulty: (form.get("difficulty") as QuizDifficulty) || null,
      });
      await load();
    } catch (err) {
      setSettingsError(translateApiError(err, t));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function onSaveGrading(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quiz) return;
    const form = new FormData(e.currentTarget);
    setGradingSaving(true);
    setGradingError(null);
    try {
      await api.patch(`/quiz-templates/${quiz.id}/grading`, {
        durationMinutes: Number(form.get("durationMinutes")),
        passScore: Number(form.get("passScore")),
        passFeedbackText: String(form.get("passFeedbackText") ?? ""),
        failFeedbackText: String(form.get("failFeedbackText") ?? ""),
        revealAnswerKey: form.get("revealAnswerKey") === "on",
      });
      await load();
    } catch (err) {
      setGradingError(translateApiError(err, t));
    } finally {
      setGradingSaving(false);
    }
  }

  async function togglePublish() {
    if (!quiz) return;
    setPublishError(null);
    setPublishing(true);
    try {
      await api.patch(`/quiz-templates/${quiz.id}/status`, {
        status: quiz.status === "published" ? "draft" : "published",
      });
      await load();
    } catch (err) {
      setPublishError(translateApiError(err, t));
    } finally {
      setPublishing(false);
    }
  }

  async function onSaveQuestion(dto: UpsertQuestionRequest) {
    if (!quiz) return;
    setQuestionSaving(true);
    setQuestionError(null);
    try {
      if (editingQuestionId === "new") {
        await api.post(`/quiz-templates/${quiz.id}/questions`, dto);
      } else if (editingQuestionId) {
        await api.patch(`/quiz-templates/${quiz.id}/questions/${editingQuestionId}`, dto);
      }
      setEditingQuestionId(null);
      await load();
    } catch (err) {
      setQuestionError(translateApiError(err, t));
    } finally {
      setQuestionSaving(false);
    }
  }

  async function onDeleteQuestion(qid: string) {
    if (!quiz) return;
    if (!confirm(t("question.deleteConfirm"))) return;
    setActionError(null);
    try {
      await api.delete(`/quiz-templates/${quiz.id}/questions/${qid}`);
      await load();
    } catch (err) {
      setActionError(translateApiError(err, t));
    }
  }

  async function onDeleteQuiz() {
    if (!quiz) return;
    if (!confirm(t("quizzes.deleteConfirm", { title: quiz.title }))) return;
    setActionError(null);
    try {
      await api.delete(`/quiz-templates/${quiz.id}`);
      navigate("/quizzes");
    } catch (err) {
      setActionError(translateApiError(err, t));
    }
  }

  return (
    <div className="page page-wide">
      <Link className="back-link" to="/quizzes">
        {t("quiz.backToList")}
      </Link>

      <div className="page-head">
        <h1>
          {quiz.title} <span className={`pill ${quiz.status}`}>{t(`quizzes.status.${quiz.status}`)}</span>
        </h1>
        <div className="form-actions">
          <button className="link danger" type="button" onClick={onDeleteQuiz}>
            {t("quizzes.delete")}
          </button>
          <button className="primary" type="button" onClick={togglePublish} disabled={publishing}>
            {quiz.status === "published" ? t("quiz.unpublish") : t("quiz.publish")}
          </button>
        </div>
      </div>
      {publishError && <div className="error">{publishError}</div>}
      {actionError && <div className="error">{actionError}</div>}
      {quiz.status === "draft" && <p className="muted">{t("quiz.publishHint")}</p>}

      <div className="card">
        <h2>{t("quiz.settings")}</h2>
        <form onSubmit={onSaveSettings}>
          {settingsError && <div className="error">{settingsError}</div>}
          <div className="field">
            <label htmlFor="title">{t("quizzes.titleLabel")}</label>
            <input id="title" name="title" defaultValue={quiz.title} required />
          </div>
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="language">{t("quizzes.language")}</label>
              <input id="language" name="language" defaultValue={quiz.language} />
            </div>
            <div className="field">
              <label htmlFor="difficulty">{t("quizzes.difficulty")}</label>
              <select id="difficulty" name="difficulty" defaultValue={quiz.difficulty ?? ""}>
                <option value="">—</option>
                <option value="easy">{t("quizzes.difficulty.easy")}</option>
                <option value="medium">{t("quizzes.difficulty.medium")}</option>
                <option value="hard">{t("quizzes.difficulty.hard")}</option>
              </select>
            </div>
          </div>
          <button className="secondary" type="submit" disabled={settingsSaving}>
            {settingsSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t("quiz.grading")}</h2>
        <form onSubmit={onSaveGrading}>
          {gradingError && <div className="error">{gradingError}</div>}
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="durationMinutes">{t("quiz.duration")}</label>
              <input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={10}
                max={60}
                defaultValue={quiz.durationMinutes}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="passScore">{t("quiz.passScore")}</label>
              <input
                id="passScore"
                name="passScore"
                type="number"
                min={0}
                max={100}
                defaultValue={quiz.passScore}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="passFeedbackText">{t("quiz.passFeedback")}</label>
            <textarea id="passFeedbackText" name="passFeedbackText" defaultValue={quiz.passFeedbackText ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="failFeedbackText">{t("quiz.failFeedback")}</label>
            <textarea id="failFeedbackText" name="failFeedbackText" defaultValue={quiz.failFeedbackText ?? ""} />
          </div>
          <div className="checkbox-row">
            <input
              id="revealAnswerKey"
              name="revealAnswerKey"
              type="checkbox"
              defaultChecked={quiz.revealAnswerKey}
            />
            <label htmlFor="revealAnswerKey">{t("quiz.revealAnswerKey")}</label>
          </div>
          <button className="secondary" type="submit" disabled={gradingSaving}>
            {gradingSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t("question.title")}</h2>

        {quiz.questions.length === 0 && editingQuestionId !== "new" && (
          <p className="muted">{t("question.empty")}</p>
        )}

        {quiz.questions.map((q) =>
          editingQuestionId === q.id ? (
            <div className="question-card" key={q.id}>
              <QuestionForm
                initial={q}
                saving={questionSaving}
                error={questionError}
                onCancel={() => {
                  setEditingQuestionId(null);
                  setQuestionError(null);
                }}
                onSave={onSaveQuestion}
              />
            </div>
          ) : (
            <div className="question-card" key={q.id}>
              <div className="question-card-head">
                <div className="question-text" dir="auto">
                  {q.text}
                </div>
                <div className="form-actions">
                  <button className="link" type="button" onClick={() => setEditingQuestionId(q.id)}>
                    {t("common.edit")}
                  </button>
                  <button className="link danger" type="button" onClick={() => onDeleteQuestion(q.id)}>
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              <ul className="option-list">
                {q.options.map((o) => (
                  <li className={o.isCorrect ? "correct" : ""} key={o.id} dir="auto">
                    {o.isCorrect ? "✓" : "—"} {o.text}
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}

        {editingQuestionId === "new" ? (
          <div className="question-card">
            <QuestionForm
              initial={null}
              saving={questionSaving}
              error={questionError}
              onCancel={() => {
                setEditingQuestionId(null);
                setQuestionError(null);
              }}
              onSave={onSaveQuestion}
            />
          </div>
        ) : (
          <button className="secondary" type="button" onClick={() => setEditingQuestionId("new")}>
            {t("question.add")}
          </button>
        )}
      </div>
    </div>
  );
}
