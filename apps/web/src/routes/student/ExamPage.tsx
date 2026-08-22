import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AttemptQuestionView, AttemptQuestionsResponse, AttemptResultResponse } from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";
import { useAuth } from "../../auth/AuthContext";

const FOCUS_LOSS_GRACE_MS = 10_000;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExamPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [questions, setQuestions] = useState<AttemptQuestionView[] | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Seconds left in the focus-loss grace period, or null when not in it —
  // drives the on-screen countdown modal below.
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
  // Captured once, before anything ever overwrites it — the modal above
  // can't be seen in a backgrounded tab, but the tab's title bar/strip
  // stays visible regardless, so that's flashed as a warning too.
  const originalTitleRef = useRef(document.title);

  // Ref, not state: the ending flag must be read synchronously inside
  // event handlers (timer tick, blur) to guarantee submit fires exactly
  // once, which a state update (async/batched) can't guarantee.
  const endingRef = useRef(false);

  const finishAttempt = useCallback(
    async (endpoint: "submit" | "auto-submit") => {
      if (!id || endingRef.current) return;
      endingRef.current = true;
      try {
        const result = await api.post<AttemptResultResponse>(`/attempts/${id}/${endpoint}`, undefined, {
          auth: false,
        });
        navigate(`/attempt/${id}/result`, { state: result });
      } catch (err) {
        endingRef.current = false;
        setError(translateApiError(err, t));
      }
    },
    [id, navigate, t],
  );

  // Initial load.
  useEffect(() => {
    if (!id) return;
    api
      .get<AttemptQuestionsResponse>(`/attempts/${id}/questions`, { auth: false })
      .then((data) => {
        if (data.endedReason) {
          // Already over (e.g. reload after time-out) — submit is
          // idempotent, so this just fetches the existing result.
          finishAttempt("submit");
          return;
        }
        setQuestions(data.questions);
        setDeadline(new Date(data.startedAt).getTime() + data.durationMinutes * 60_000);
      })
      .catch((err) => setError(translateApiError(err, t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Server-authoritative countdown display (3.7) — the timer here is a
  // convenience; hitting zero just calls the normal submit endpoint,
  // which independently re-checks the deadline server-side regardless
  // of what this client clock says.
  useEffect(() => {
    if (deadline === null) return;
    function tick() {
      const remaining = Math.max(0, Math.round(((deadline as number) - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) finishAttempt("submit");
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline, finishAttempt]);

  // Focus-loss auto-submit with a short grace period (v2.5, 3.8) — absorbs
  // a brief notification-shade peek or address-bar tap without ending a
  // genuine app-switch any less promptly. Ticks a visible countdown
  // (graceCountdown) rather than firing one silent timeout, so a student
  // who's still looking at the screen (e.g. clicked just outside the
  // browser window without truly switching away) sees a clear, active
  // warning instead of the exam just quietly ending.
  useEffect(() => {
    let graceInterval: ReturnType<typeof setInterval> | null = null;

    function startGrace() {
      if (graceInterval || endingRef.current) return;
      let secondsLeft = Math.ceil(FOCUS_LOSS_GRACE_MS / 1000);
      setGraceCountdown(secondsLeft);
      graceInterval = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (graceInterval) clearInterval(graceInterval);
          graceInterval = null;
          setGraceCountdown(null);
          finishAttempt("auto-submit");
          return;
        }
        setGraceCountdown(secondsLeft);
      }, 1000);
    }
    function cancelGrace() {
      if (graceInterval) {
        clearInterval(graceInterval);
        graceInterval = null;
      }
      setGraceCountdown(null);
    }
    function onVisibilityChange() {
      if (document.hidden) startGrace();
      else cancelGrace();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", startGrace);
    window.addEventListener("focus", cancelGrace);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", startGrace);
      window.removeEventListener("focus", cancelGrace);
      cancelGrace();
    };
  }, [finishAttempt]);

  // The on-screen modal can't be seen in a backgrounded tab, but the tab's
  // own title (in the tab strip/title bar) stays visible regardless of
  // focus — flash a countdown there too, so switching tabs isn't
  // completely silent even though nothing can pop up over the active tab.
  useEffect(() => {
    document.title = graceCountdown !== null ? t("exam.tabWarning", { seconds: graceCountdown }) : originalTitleRef.current;
  }, [graceCountdown, t]);

  useEffect(() => {
    return () => {
      document.title = originalTitleRef.current;
    };
  }, []);

  // Native "leave site?" confirmation for closing the tab, refreshing, or
  // navigating away by URL — the one case where the browser can actually
  // show a blocking popup before the page unloads. A tab/app switch (above)
  // can't trigger this: the page already loses visibility before any
  // dialog could render, which is why that case relies on the on-screen
  // banner instead.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (endingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function updateAnswer(questionId: string, selectedOptionIds: string[]) {
    setQuestions((prev) =>
      prev ? prev.map((q) => (q.id === questionId ? { ...q, selectedOptionIds } : q)) : prev,
    );
    api.put(`/attempts/${id}/answers/${questionId}`, { selectedOptionIds }, { auth: false }).catch((err) => {
      setError(translateApiError(err, t));
    });
  }

  function toggleOption(question: AttemptQuestionView, optionId: string) {
    if (question.type === "single") {
      updateAnswer(question.id, [optionId]);
    } else {
      const has = question.selectedOptionIds.includes(optionId);
      const next = has
        ? question.selectedOptionIds.filter((o) => o !== optionId)
        : [...question.selectedOptionIds, optionId];
      updateAnswer(question.id, next);
    }
  }

  // Keystrokes only update local state (instant, no network); the actual
  // save fires on blur, matching how option selections save immediately
  // but without spamming a request per character typed.
  function onTextAnswerChange(questionId: string, answerText: string) {
    setQuestions((prev) => (prev ? prev.map((q) => (q.id === questionId ? { ...q, answerText } : q)) : prev));
  }

  function onTextAnswerBlur(question: AttemptQuestionView) {
    api
      .put(`/attempts/${id}/answers/${question.id}`, { selectedOptionIds: [], answerText: question.answerText ?? "" }, { auth: false })
      .catch((err) => setError(translateApiError(err, t)));
  }

  function isAnswered(q: AttemptQuestionView): boolean {
    return q.type === "open" ? Boolean(q.answerText?.trim()) : q.selectedOptionIds.length > 0;
  }

  function onSubmitClick() {
    if (confirm(t("exam.submitConfirm"))) finishAttempt("submit");
  }

  if (error && !questions) return <div className="page error">{error}</div>;
  if (!questions) return <div className="page muted">{t("exam.loading")}</div>;

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="page">
      <div className="exam-topbar">
        <span className="muted">{t("exam.questionOf", { current: currentIndex + 1, total: questions.length })}</span>
        {remainingSeconds !== null && (
          <span className="exam-timer">
            {t("exam.timeLeft")}: {formatTime(remainingSeconds)}
          </span>
        )}
      </div>
      {isAuthenticated && (
        <div className="exam-teacher-link">
          <Link to="/cohorts">{t("exam.teacherLink")}</Link>
        </div>
      )}

      <p className="exam-leave-warning">{t("exam.leaveWarning")}</p>

      {graceCountdown !== null && (
        <div className="grace-overlay" role="alertdialog" aria-live="assertive">
          <div className="grace-modal">
            <p>{t("exam.graceWarning", { seconds: graceCountdown })}</p>
          </div>
        </div>
      )}

      <div className="question-navigator">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={`nav-dot ${i === currentIndex ? "current" : ""} ${isAnswered(q) ? "answered" : ""}`}
            onClick={() => setCurrentIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="question-text" dir="auto">
          {question.text}
        </div>
        {question.type === "open" ? (
          <>
            <p className="muted">{t("exam.typeYourAnswer", { points: question.points })}</p>
            <textarea
              className="exam-text-answer"
              dir="auto"
              value={question.answerText ?? ""}
              onChange={(e) => onTextAnswerChange(question.id, e.target.value)}
              onBlur={() => onTextAnswerBlur(question)}
            />
            {!isAnswered(question) && <p className="muted">{t("exam.unanswered")}</p>}
          </>
        ) : (
          <>
            <p className="muted">{question.type === "single" ? t("exam.selectOne") : t("exam.selectMultiple")}</p>
            <ul className="answer-choice-list">
              {question.options.map((opt) => {
                const checked = question.selectedOptionIds.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <label className="answer-choice">
                      <input
                        type={question.type === "single" ? "radio" : "checkbox"}
                        name={`q-${question.id}`}
                        checked={checked}
                        onChange={() => toggleOption(question, opt.id)}
                      />
                      <span className="answer-choice-text" dir="auto">
                        {opt.text}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {!isAnswered(question) && <p className="muted">{t("exam.unanswered")}</p>}
          </>
        )}
      </div>

      <div className="form-actions">
        <button
          className="secondary"
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          {t("exam.previous")}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={isLast}
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          {t("exam.next")}
        </button>
        {isLast && (
          <button className="primary" type="button" onClick={onSubmitClick}>
            {t("exam.submit")}
          </button>
        )}
      </div>
    </div>
  );
}
