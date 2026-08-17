import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function AccessibilityPage() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <Link className="back-link" to="/">
        {t("accessibility.backLink")}
      </Link>
      <h1>{t("accessibility.title")}</h1>
      <div className="card">
        <p>{t("accessibility.intro")}</p>

        <h2>{t("accessibility.measuresTitle")}</h2>
        <ul className="warning-list">
          <li>{t("accessibility.measure1")}</li>
          <li>{t("accessibility.measure2")}</li>
          <li>{t("accessibility.measure3")}</li>
          <li>{t("accessibility.measure4")}</li>
        </ul>

        <h2>{t("accessibility.limitationsTitle")}</h2>
        <p>{t("accessibility.limitations")}</p>

        <h2>{t("accessibility.contactTitle")}</h2>
        <p>
          {t("accessibility.contactText")}{" "}
          <a href="https://wa.me/972545966296" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          .
        </p>
      </div>
    </div>
  );
}
