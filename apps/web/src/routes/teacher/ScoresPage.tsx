import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import type { CohortResponse, CohortScoresResponse, ScoreRow } from "@bohan-peta/shared-types";
import { api, downloadAuthenticated } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

type SortKey = "studentName" | "quizTitle" | "score" | "submittedAt";

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ScoresPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [cohort, setCohort] = useState<CohortResponse | null>(null);
  const [scores, setScores] = useState<CohortScoresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<CohortResponse>(`/cohorts/${id}`),
      api.get<CohortScoresResponse>(`/cohorts/${id}/scores`),
    ])
      .then(([c, s]) => {
        setCohort(c);
        setScores(s);
      })
      .catch((err) => setError(translateApiError(err, t)));
  }, [id]);

  const quizTitles = useMemo(
    () => Array.from(new Set((scores ?? []).map((r) => r.quizTitle))),
    [scores],
  );

  const rows = useMemo(() => {
    if (!scores) return [];
    let filtered = scores;
    if (quizFilter !== "all") filtered = filtered.filter((r) => r.quizTitle === quizFilter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => r.studentName.toLowerCase().includes(needle) || r.nationalId.includes(needle),
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "studentName") cmp = a.studentName.localeCompare(b.studentName);
      else if (sortKey === "quizTitle") cmp = a.quizTitle.localeCompare(b.quizTitle);
      else if (sortKey === "score") cmp = (a.score ?? -1) - (b.score ?? -1);
      else if (sortKey === "submittedAt") {
        cmp = (a.submittedAt ? Date.parse(a.submittedAt) : 0) - (b.submittedAt ? Date.parse(b.submittedAt) : 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [scores, quizFilter, search, sortKey, sortDir]);

  const summary = useMemo(() => {
    const submitted = (scores ?? []).filter((r) => r.score !== null);
    const passedCount = submitted.filter((r) => r.passed).length;
    const avg = submitted.length
      ? Math.round(submitted.reduce((sum, r) => sum + (r.score ?? 0), 0) / submitted.length)
      : null;
    return {
      total: scores?.length ?? 0,
      submitted: submitted.length,
      avgScore: avg,
      passRate: submitted.length ? Math.round((passedCount / submitted.length) * 100) : null,
    };
  }, [scores]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "studentName" || key === "quizTitle" ? "asc" : "desc");
    }
  }

  async function onExport() {
    if (!id) return;
    setError(null);
    setExporting(true);
    try {
      await downloadAuthenticated(`/cohorts/${id}/scores/export`, "scores.csv");
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setExporting(false);
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (!cohort || !scores) return <div className="page muted">{t("common.loading")}</div>;

  return (
    <div className="page page-wide">
      <Link className="back-link" to={`/cohorts/${id}`}>
        {t("scores.backToCohort")}
      </Link>
      <div className="page-head">
        <h1>
          {t("scores.title")} — {cohort.name}
        </h1>
        <button className="secondary" type="button" onClick={onExport} disabled={exporting || scores.length === 0}>
          {exporting ? t("common.loading") : t("scores.export")}
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="scores-summary">
          <div className="scores-stat">
            <div className="scores-stat-value">{summary.total}</div>
            <div className="scores-stat-label">{t("scores.stat.total")}</div>
          </div>
          <div className="scores-stat">
            <div className="scores-stat-value">{summary.submitted}</div>
            <div className="scores-stat-label">{t("scores.stat.submitted")}</div>
          </div>
          <div className="scores-stat">
            <div className="scores-stat-value">{summary.avgScore ?? "—"}</div>
            <div className="scores-stat-label">{t("scores.stat.avgScore")}</div>
          </div>
          <div className="scores-stat">
            <div className="scores-stat-value">{summary.passRate !== null ? `${summary.passRate}%` : "—"}</div>
            <div className="scores-stat-label">{t("scores.stat.passRate")}</div>
          </div>
        </div>
      </div>

      <div className="card">
        {scores.length === 0 ? (
          <p className="muted">{t("scores.empty")}</p>
        ) : (
          <>
            <div className="settings-grid">
              <div className="field">
                <label htmlFor="score-search">{t("scores.search")}</label>
                <input id="score-search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="score-quiz-filter">{t("scores.filterByQuiz")}</label>
                <select id="score-quiz-filter" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
                  <option value="all">{t("scores.allQuizzes")}</option>
                  {quizTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-scroll">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("studentName")}>
                      {t("scores.col.student")}
                      {sortIndicator("studentName")}
                    </th>
                    <th>{t("scores.col.nationalId")}</th>
                    <th onClick={() => toggleSort("quizTitle")}>
                      {t("scores.col.quiz")}
                      {sortIndicator("quizTitle")}
                    </th>
                    <th>{t("scores.col.status")}</th>
                    <th onClick={() => toggleSort("score")}>
                      {t("scores.col.score")}
                      {sortIndicator("score")}
                    </th>
                    <th>{t("scores.col.result")}</th>
                    <th>{t("scores.col.timeTaken")}</th>
                    <th onClick={() => toggleSort("submittedAt")}>
                      {t("scores.col.submittedAt")}
                      {sortIndicator("submittedAt")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: ScoreRow) => (
                    <tr key={r.attemptId}>
                      <td dir="auto">{r.studentName}</td>
                      <td>{r.nationalId}</td>
                      <td dir="auto">{r.quizTitle}</td>
                      <td>
                        <span className={`pill status-${r.status}`}>{t(`scores.status.${r.status}`)}</span>
                      </td>
                      <td>{r.score !== null ? `${Math.round(r.score)}%` : "—"}</td>
                      <td>
                        {r.passed === null ? (
                          "—"
                        ) : (
                          <span className={`pill ${r.passed ? "published" : "draft"}`}>
                            {r.passed ? t("result.pass") : t("result.fail")}
                          </span>
                        )}
                      </td>
                      <td>{r.timeTakenSeconds !== null ? formatMinSec(r.timeTakenSeconds) : "—"}</td>
                      <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <p className="muted">{t("scores.noMatches")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
