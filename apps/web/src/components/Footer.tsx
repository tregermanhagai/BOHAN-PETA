import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { version } from "../../package.json";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <Link to="/accessibility">{t("footer.accessibility")}</Link>
      <span className="footer-copyright">
        All rights reserved:{" "}
        <a href="https://github.com/tregermanhagai" target="_blank" rel="noreferrer">
          hagai.tregerman
        </a>{" "}
        {year} ©
      </span>
      <span className="app-version" title={`Built ${__BUILD_TIME__}`}>
        v{version} ({__GIT_SHA__})
      </span>
    </footer>
  );
}
