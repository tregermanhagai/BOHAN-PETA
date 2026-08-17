import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { AttemptResultResponse } from "@bohan-peta/shared-types";
import { api } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

export function ResultPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState<AttemptResultResponse | null>(
    (location.state as AttemptResultResponse | undefined) ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result || !id) return;
    // Direct visit / refresh with no router state — submit is idempotent,
    // so re-calling it just returns the already-computed result.
    api
      .post<AttemptResultResponse>(`/attempts/${id}/submit`, undefined, { auth: false })
      .then(setResult)
      .catch((err) => setError(translateApiError(err, t)));
  }, [id, result]);

  if (error) return <div className="page error">{error}</div>;
  if (!result) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page">
      <h1>{t("result.title")}</h1>
      <div className="card">
        <span className={`result-badge ${result.passed ? "pass" : "fail"}`}>
          {result.passed ? t("result.pass") : t("result.fail")}
        </span>
        <div className="result-score">{Math.round(result.score)}%</div>
        <p dir="auto">{result.feedbackText}</p>
        <p className="muted">{t(`result.endedReason.${result.endedReason}`)}</p>
        <div className="form-actions">
          <Link className="secondary" to={`/review/${result.reviewToken}`}>
            {t("result.reviewLink")}
          </Link>
          <button className="primary" type="button" onClick={() => navigate("/join")}>
            {t("result.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
