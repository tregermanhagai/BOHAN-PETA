import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import type { CohortResponse, CohortScoresResponse, ScoreRow } from "@bohan-peta/shared-types";
import { api, downloadAuthenticated } from "../../lib/api-client";
import { translateApiError } from "../../lib/error-messages";

type SortKey = "studentName" | "quizTitle" | "score" | "submittedAt";

interface StudentGroup {
  studentId: string;
  studentName: string;
  nationalId: string;
  attempts: ScoreRow[];
  avgScore: number | null;
}

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function canGrade(row: ScoreRow): boolean {
  return row.status !== "in_progress";
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
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

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

  const groupedRows = useMemo<StudentGroup[]>(() => {
    const order: string[] = [];
    const byStudent = new Map<string, ScoreRow[]>();
    for (const r of rows) {
      if (!byStudent.has(r.studentId)) {
        byStudent.set(r.studentId, []);
        order.push(r.studentId);
      }
      byStudent.get(r.studentId)!.push(r);
    }
    return order.map((studentId) => {
      const attempts = byStudent.get(studentId)!;
      const submitted = attempts.filter((a) => a.score !== null);
      const avgScore = submitted.length
        ? Math.round(submitted.reduce((sum, a) => sum + (a.score ?? 0), 0) / submitted.length)
        : null;
      return { studentId, studentName: attempts[0].studentName, nationalId: attempts[0].nationalId, attempts, avgScore };
    });
  }, [rows]);

  function toggleExpanded(studentId: string) {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelected(attemptId: string) {
    setSelectedAttemptIds((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedAttemptIds(checked ? new Set(rows.map((r) => r.attemptId)) : new Set());
  }

  async function onDeleteSelected() {
    if (selectedAttemptIds.size === 0) return;
    if (!confirm(t("scores.deleteSelectedConfirm", { count: selectedAttemptIds.size }))) return;
    setDeleting(true);
    setError(null);
    try {
      await Promise.all(Array.from(selectedAttemptIds).map((attemptId) => api.delete(`/attempts/${attemptId}`)));
      setScores((prev) => (prev ?? []).filter((r) => !selectedAttemptIds.has(r.attemptId)));
      setSelectedAttemptIds(new Set());
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setDeleting(false);
    }
  }

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

            <div className="scores-toolbar">
              <button
                className="link danger"
                type="button"
                onClick={onDeleteSelected}
                disabled={deleting || selectedAttemptIds.size === 0}
              >
                {deleting ? t("common.loading") : t("scores.deleteSelected")}
                {selectedAttemptIds.size > 0 ? ` (${selectedAttemptIds.size})` : ""}
              </button>
            </div>

            <div className="table-scroll">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th className="not-sortable">
                      <input
                        type="checkbox"
                        aria-label={t("scores.selectAll")}
                        checked={rows.length > 0 && rows.every((r) => selectedAttemptIds.has(r.attemptId))}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="not-sortable">{t("scores.col.grading")}</th>
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
                  {groupedRows.map((g) => {
                    const expanded = expandedStudentIds.has(g.studentId);
                    return (
                      <Fragment key={g.studentId}>
                        <tr className="student-summary-row">
                          <td />
                          <td dir="auto">
                            <button
                              className="expand-toggle"
                              type="button"
                              aria-label={expanded ? t("scores.collapse") : t("scores.expand")}
                              onClick={() => toggleExpanded(g.studentId)}
                            >
                              {expanded ? "−" : "+"}
                            </button>
                            {g.studentName}
                          </td>
                          <td>{g.nationalId}</td>
                          <td className="muted" colSpan={2}>
                            {t("scores.attemptsCount", { count: g.attempts.length })}
                          </td>
                          <td>{g.avgScore !== null ? `${g.avgScore}%` : "—"}</td>
                          <td colSpan={3} />
                        </tr>
                        {expanded &&
                          g.attempts.map((r: ScoreRow) => (
                            <tr className="attempt-row" key={r.attemptId}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedAttemptIds.has(r.attemptId)}
                                  onChange={() => toggleSelected(r.attemptId)}
                                />
                              </td>
                              <td>
                                {canGrade(r) ? (
                                  <Link className="link" to={`/attempts/${r.attemptId}/grading`}>
                                    {t("common.edit")}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td />
                              <td />
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
                      </Fragment>
                    );
                  })}
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
