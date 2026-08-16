import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { CohortResponse, CreateCohortRequest } from "@bohan-peta/shared-types";
import { api, ApiError } from "../../lib/api-client";

export function CohortsPage() {
  const { t } = useTranslation();
  const [cohorts, setCohorts] = useState<CohortResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const data = await api.get<CohortResponse[]>("/cohorts");
      setCohorts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load cohorts");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (startDate && endDate && endDate < startDate) {
      setError(t("cohorts.dateRangeInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const body: CreateCohortRequest = {
        name,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      await api.post<CohortResponse>("/cohorts", body);
      setName("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create cohort");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleArchive(cohort: CohortResponse) {
    try {
      await api.patch<CohortResponse>(`/cohorts/${cohort.id}`, { archived: !cohort.archived });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update cohort");
    }
  }

  async function onDelete(cohort: CohortResponse) {
    if (!confirm(t("cohorts.deleteConfirm", { name: cohort.name }))) return;
    try {
      await api.delete(`/cohorts/${cohort.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete cohort");
    }
  }

  return (
    <div className="page">
      <h1>{t("cohorts.title")}</h1>

      <div className="card">
        <form onSubmit={onCreate}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="cohort-name">{t("cohorts.name")}</label>
            <input id="cohort-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="start-date">{t("cohorts.startDate")}</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="end-date">{t("cohorts.endDate")}</label>
            <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("cohorts.create")}
          </button>
        </form>
      </div>

      <div className="card">
        {cohorts === null && <p className="muted">{t("common.loading")}</p>}
        {cohorts !== null && cohorts.length === 0 && <p className="muted">{t("cohorts.empty")}</p>}
        {cohorts !== null &&
          cohorts.map((c) => (
            <div className="cohort-row" key={c.id}>
              <div>
                <div className="cohort-name">
                  <Link to={`/cohorts/${c.id}`}>{c.name}</Link>{" "}
                  {c.archived && <span className="pill">{t("cohorts.archived")}</span>}
                </div>
                <div className="cohort-dates">
                  {c.startDate ?? "—"} – {c.endDate ?? "—"}
                </div>
              </div>
              <div className="form-actions">
                <button className="link" type="button" onClick={() => toggleArchive(c)}>
                  {c.archived ? t("cohorts.unarchive") : t("cohorts.archive")}
                </button>
                <button className="link danger" type="button" onClick={() => onDelete(c)}>
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
