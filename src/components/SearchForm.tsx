"use client";
import { FiSearch, FiMapPin, FiArrowRight } from "react-icons/fi";
export function SearchForm({
  query = "",
  city = "",
}: {
  query?: string;
  city?: string;
}) {
  return (
    <form action="/events" className="search-form" role="search">
      <div className="search-term">
        <FiSearch />
        <label className="sr-only" htmlFor="event-query">
          Search events
        </label>
        <input
          id="event-query"
          name="q"
          defaultValue={query}
          placeholder="What are you into?"
        />
      </div>
      <div className="search-city">
        <FiMapPin />
        <label className="sr-only" htmlFor="event-city">
          City
        </label>
        <input
          id="event-city"
          name="city"
          defaultValue={city}
          placeholder="Any city"
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
        Find events <FiArrowRight />
      </button>
    </form>
  );
}
