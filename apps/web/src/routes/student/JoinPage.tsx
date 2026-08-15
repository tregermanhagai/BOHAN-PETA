import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JoinAttemptRequest, JoinAttemptResponse } from "@bohan-peta/shared-types";
import { api, ApiError } from "../../lib/api-client";

export function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "warnings">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Just moves to the warnings screen — the actual join call (which
  // starts the server-side exam timer) waits until the student
  // acknowledges the warnings and clicks Start, so reading them doesn't
  // eat into their exam time.
  function onContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("warnings");
  }

  async function onStartExam() {
    setError(null);
    setSubmitting(true);
    try {
      const body: JoinAttemptRequest = {
        firstName,
        lastName,
        nationalId,
        email: email || null,
        accessCode,
      };
      const res = await api.post<JoinAttemptResponse>("/assignments/join", body, { auth: false });
      navigate(`/attempt/${res.attemptId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (step === "warnings") {
    return (
      <div className="page">
        <h1>{t("join.warningsTitle")}</h1>
        <div className="card">
          {error && <div className="error">{error}</div>}
          <ul className="warning-list">
            <li>{t("join.warning1")}</li>
            <li>{t("join.warning2")}</li>
            <li>{t("join.warning3")}</li>
            <li>{t("join.warning4")}</li>
          </ul>
          <p className="warning-good-luck">{t("join.goodLuck")}</p>
          <div className="form-actions">
            <button className="secondary" type="button" onClick={() => setStep("form")} disabled={submitting}>
              {t("join.editDetails")}
            </button>
            <button className="primary" type="button" onClick={onStartExam} disabled={submitting}>
              {submitting ? t("common.loading") : t("join.submit")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t("join.title")}</h1>
      <div className="card">
        <form onSubmit={onContinue}>
          {error && <div className="error">{error}</div>}
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="firstName">{t("join.firstName")}</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lastName">{t("join.lastName")}</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="nationalId">{t("join.nationalId")}</label>
            <input
              id="nationalId"
              required
              inputMode="numeric"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">{t("join.email")}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="muted">{t("join.emailHint")}</span>
          </div>
          <div className="field">
            <label htmlFor="accessCode">{t("join.accessCode")}</label>
            <input
              id="accessCode"
              required
              inputMode="numeric"
              autoComplete="off"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
            <span className="muted">{t("join.accessCodeHint")}</span>
          </div>
          <button className="primary" type="submit">
            {t("join.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
