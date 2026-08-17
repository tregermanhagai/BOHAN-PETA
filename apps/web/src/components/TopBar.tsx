import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { setLanguage } from "../i18n";

export function TopBar() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="topbar">
      <Link className="brand" to="/">
        {t("app.name")}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {isAuthenticated && (
          <>
            <Link to="/cohorts">{t("nav.cohorts")}</Link>
            <Link to="/quizzes">{t("nav.quizzes")}</Link>
            <button className="link" type="button" onClick={logout}>
              {t("auth.logout")}
            </button>
          </>
        )}
        <a href="https://wa.me/972545966296" target="_blank" rel="noreferrer">
          {t("nav.contact")}
        </a>
        <div className="lang-switch">
          <button
            type="button"
            aria-pressed={i18n.language === "he"}
            onClick={() => setLanguage("he")}
          >
            עברית
          </button>
          <button
            type="button"
            aria-pressed={i18n.language === "en"}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
