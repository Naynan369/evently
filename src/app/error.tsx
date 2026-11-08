"use client";
import { useApp } from "@/components/AppProvider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useApp();
  return (
    <main id="main" className="container section page-main">
      <div className="empty-state">
        <h1>{t("page.errorTitle")}</h1>
        <p>{t("page.errorBody")}</p>
        <button className="button button-primary" onClick={reset}>
          {t("page.tryAgain")}
        </button>
      </div>
    </main>
  );
}
