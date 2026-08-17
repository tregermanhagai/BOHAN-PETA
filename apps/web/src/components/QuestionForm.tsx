import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AnswerOptionInput, QuestionResponse, QuestionType, UpsertQuestionRequest } from "@bohan-peta/shared-types";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function emptyOptions(): AnswerOptionInput[] {
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

export function QuestionForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  saving,
  error,
}: {
  initial: QuestionResponse | null;
  onSave: (dto: UpsertQuestionRequest) => void;
  onCancel: () => void;
  /** Omitted when creating a new question — there's nothing to delete yet. */
  onDelete?: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial?.text ?? "");
  const [type, setType] = useState<QuestionType>(initial?.type ?? "single");
  const [options, setOptions] = useState<AnswerOptionInput[]>(
    initial ? initial.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : emptyOptions(),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function setOptionText(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  }

  function toggleCorrect(index: number) {
    setOptions((prev) => {
      if (type === "single") {
        return prev.map((o, i) => ({ ...o, isCorrect: i === index }));
      }
      return prev.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o));
    });
  }

  function changeType(next: QuestionType) {
    setType(next);
    if (next === "single") {
      // Keep only the first previously-correct option, so switching
      // multi -> single can't silently leave two "correct" answers.
      setOptions((prev) => {
        const firstCorrect = prev.findIndex((o) => o.isCorrect);
        return prev.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }));
      });
    }
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (options.length < MIN_OPTIONS) {
      setLocalError(t("question.minOptions"));
      return;
    }
    if (options.length > MAX_OPTIONS) {
      setLocalError(t("question.maxOptions"));
      return;
    }
    onSave({ text, type, options });
  }

  return (
    <form onSubmit={onSubmit}>
      {(error ?? localError) && <div className="error">{error ?? localError}</div>}

      <div className="field">
        <label htmlFor="q-text">{t("question.text")}</label>
        <textarea id="q-text" dir="auto" required value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="q-type">{t("question.type")}</label>
        <select id="q-type" value={type} onChange={(e) => changeType(e.target.value as QuestionType)}>
          <option value="single">{t("question.type.single")}</option>
          <option value="multi">{t("question.type.multi")}</option>
        </select>
      </div>

      <div className="field">
        <label>{t("question.options")}</label>
        {options.map((opt, i) => (
          <div className="option-row" key={i}>
            <input
              type={type === "single" ? "radio" : "checkbox"}
              name="correct-option"
              checked={opt.isCorrect}
              onChange={() => toggleCorrect(i)}
              aria-label={t("question.correct")}
            />
            <input
              type="text"
              dir="auto"
              required
              placeholder={t("question.optionText")}
              value={opt.text}
              onChange={(e) => setOptionText(i, e.target.value)}
            />
            <button
              type="button"
              className="link danger"
              onClick={() => removeOption(i)}
              disabled={options.length <= MIN_OPTIONS}
            >
              {t("question.removeOption")}
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
          {t("question.addOption")}
        </button>
      </div>

      <div className="form-actions">
        <button className="primary" type="submit" disabled={saving}>
          {saving ? t("common.loading") : t("common.save")}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        {onDelete && (
          <button type="button" className="link danger" onClick={onDelete}>
            {t("common.delete")}
          </button>
        )}
      </div>
    </form>
  );
}
