"use client";
import { FiSearch, FiMapPin, FiArrowRight } from "react-icons/fi";
import { useApp } from "./AppProvider";
export function SearchForm({
  query = "",
  city = "",
}: {
  query?: string;
  city?: string;
}) {
  const { t } = useApp();
  return (
    <form action="/events" className="search-form" role="search">
      <div className="search-term">
        <FiSearch />
        <label className="sr-only" htmlFor="event-query">
          {t("common.searchEvents")}
        </label>
        <input
          id="event-query"
          name="q"
          defaultValue={query}
          placeholder={t("common.searchPlaceholder")}
        />
      </div>
      <div className="search-city">
        <FiMapPin />
        <label className="sr-only" htmlFor="event-city">
          {t("common.city")}
        </label>
        <input
          id="event-city"
          name="city"
          defaultValue={city}
          placeholder={t("common.cityPlaceholder")}
          list="suggested-cities"
        />
        <datalist id="suggested-cities">
          <option value="London" />
          <option value="Manchester" />
          <option value="Bristol" />
          <option value="Brighton" />
        </datalist>
      </div>
      <button className="button button-primary" type="submit">
        {t("common.search")} <FiArrowRight />
      </button>
    </form>
  );
}
