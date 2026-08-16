import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { translateApiError } from "../../lib/error-messages";

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate("/cohorts");
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>{t("auth.register.title")}</h1>
      <div className="card">
        <form onSubmit={onSubmit}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="name">{t("auth.register.name")}</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">{t("auth.login.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("auth.login.password")}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("auth.register.submit")}
          </button>
        </form>
      </div>
      <p className="muted">
        {t("auth.register.haveAccount")} <Link to="/login">{t("auth.login.submit")}</Link>
      </p>
    </div>
  );
}
