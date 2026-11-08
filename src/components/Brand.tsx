import Link from "next/link";
import { useApp } from "./AppProvider";
export function Brand({ light = false }: { light?: boolean }) {
  const { t } = useApp();
  return (
    <Link
      href="/"
      className={"brand" + (light ? " brand-light" : "")}
      aria-label={t("brand.home")}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 2C9 2 6 8 11 13C3 10 0 16 5 21C9 25 13 23 15 20C13 28 19 32 24 27C28 23 25 18 21 17C29 18 32 11 26 7C22 4 19 7 17 11C19 6 19 3 16 2Z"
          fill="currentColor"
        />
      </svg>
      <span>
        evently<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
