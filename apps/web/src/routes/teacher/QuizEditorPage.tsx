import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  GenerateQuestionsQuestionType,
  QuizDifficulty,
  QuizTemplateResponse,
  UpsertQuestionRequest,
} from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";
import { QuestionForm } from "../../components/QuestionForm";

// Mirrors the backend's default (apps/api/src/quiz-templates/quiz-templates.service.ts)
// — new quizzes already get this saved at creation time; these fallbacks
// only matter for quizzes created before that default existed.
function defaultPassFeedback(language: string): string {
  return language === "he" ? "עברת את המבדק" : "You passed!";
}
function defaultFailFeedback(language: string): string {
  return language === "he" ? "לא עברת את המבדק, עלייך לחזור על החומר" : "You did not pass the exam.";
}

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
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [gradingSaving, setGradingSaving] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingDirty, setGradingDirty] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSettingsDirty(false);
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
      setGradingDirty(false);
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

  async function onGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quiz) return;
    const form = new FormData(e.currentTarget);
    const topic = String(form.get("topic") ?? "").trim();
    const file = fileInputRef.current?.files?.[0] ?? null;

    if (!topic && !file) {
      setGenerateError(t("ai.needTopicOrFile"));
      return;
    }

    const body = new FormData();
    if (topic) body.set("topic", topic);
    body.set("questionCount", String(form.get("questionCount")));
    body.set("optionsPerQuestion", String(form.get("optionsPerQuestion")));
    body.set("questionType", String(form.get("questionType")));
    if (file) body.set("file", file);

    setGenerating(true);
    setGenerateError(null);
    try {
      await api.postForm(`/quiz-templates/${quiz.id}/generate`, body);
      // New questions land at the bottom of the (already-existing) list
      // below, as ordinary draft questions — same edit/delete controls,
      // same publish gate. Topic is intentionally not cleared, so
      // generating a second batch on the same subject is a one-click repeat
      // — the file is cleared, since reusing the same upload is less likely.
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setGenerateError(translateApiError(err, t));
    } finally {
      setGenerating(false);
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
      if (editingQuestionId === qid) {
        setEditingQuestionId(null);
        setQuestionError(null);
      }
      // Remove it from local state immediately — don't rely solely on the
      // reload below to make the deletion visible (the edit form closing
      // at the same time was masking this: nothing else forced a repaint
      // of the still-open list until later).
      setQuiz((prev) => (prev ? { ...prev, questions: prev.questions.filter((q) => q.id !== qid) } : prev));
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
        <form onSubmit={onSaveSettings} onChange={() => setSettingsDirty(true)}>
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
          <button className="secondary" type="submit" disabled={settingsSaving || !settingsDirty}>
            {settingsSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t("quiz.grading")}</h2>
        <form onSubmit={onSaveGrading} onChange={() => setGradingDirty(true)}>
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
            <textarea
              id="passFeedbackText"
              name="passFeedbackText"
              defaultValue={quiz.passFeedbackText ?? defaultPassFeedback(quiz.language)}
            />
          </div>
          <div className="field">
            <label htmlFor="failFeedbackText">{t("quiz.failFeedback")}</label>
            <textarea
              id="failFeedbackText"
              name="failFeedbackText"
              defaultValue={quiz.failFeedbackText ?? defaultFailFeedback(quiz.language)}
            />
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
          <button className="secondary" type="submit" disabled={gradingSaving || !gradingDirty}>
            {gradingSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t("ai.generate")}</h2>
        <p className="muted">{t("ai.hint")}</p>
        <form onSubmit={onGenerate}>
          {generateError && <div className="error">{generateError}</div>}
          <div className="field">
            <label htmlFor="ai-topic">{t("ai.topic")}</label>
            <textarea id="ai-topic" name="topic" placeholder={t("ai.topicPlaceholder")} />
            <span className="muted">{t("ai.topicHint")}</span>
          </div>
          <div className="field">
            <label htmlFor="ai-file">{t("ai.file")}</label>
            <input id="ai-file" ref={fileInputRef} type="file" accept=".pdf,.docx" />
            <span className="muted">{t("ai.fileHint")}</span>
          </div>
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="ai-questionCount">{t("ai.questionCount")}</label>
              <input id="ai-questionCount" name="questionCount" type="number" min={3} max={100} defaultValue={5} required />
            </div>
            <div className="field">
              <label htmlFor="ai-optionsPerQuestion">{t("ai.optionsPerQuestion")}</label>
              <input
                id="ai-optionsPerQuestion"
                name="optionsPerQuestion"
                type="number"
                min={2}
                max={6}
                defaultValue={4}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ai-questionType">{t("ai.questionType")}</label>
              <select id="ai-questionType" name="questionType" defaultValue="single">
                <option value="single">{t("ai.questionType.single")}</option>
                <option value="multi">{t("ai.questionType.multi")}</option>
                <option value="mixed">{t("ai.questionType.mixed")}</option>
              </select>
            </div>
          </div>
          <button className="secondary" type="submit" disabled={generating}>
            {generating ? t("ai.generating") : t("ai.generateButton")}
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
                onDelete={() => onDeleteQuestion(q.id)}
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
