import { getLanguage } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export default async function Loading() {
  const language = await getLanguage();
  return (
    <main id="main" className="loading">
      <div role="status">
        <div className="loading-ring" />
        {translate(language, "page.loading")}
      </div>
    </main>
  );
}
