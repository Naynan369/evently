"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiMail,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import { useApp } from "@/components/AppProvider";
import { api } from "@/lib/client";
import type {
  CrmContact,
  CrmDetail,
  CrmSegment,
  CrmStatus,
} from "@/lib/admin-crm";
import styles from "@/styles/AdminCrm.module.css";

type CrmList = {
  contacts: CrmContact[];
  page: number;
  pageSize: number;
  filteredTotal: number;
  counts: { total: number; attendees: number; organizers: number; due: number };
};

const segments: Array<{ value: CrmSegment; en: string; it: string }> = [
  { value: "all", en: "All contacts", it: "Tutti" },
  { value: "attendees", en: "Attendees", it: "Partecipanti" },
  { value: "organizers", en: "Organizers", it: "Organizzatori" },
  { value: "due", en: "Due now", it: "Da seguire" },
];

function statusLabel(value: CrmStatus, it: boolean) {
  const labels = {
    none: ["No action", "Nessuna azione"],
    open: ["Follow up", "Da seguire"],
    waiting: ["Waiting", "In attesa"],
    resolved: ["Resolved", "Risolto"],
  } as const;
  return labels[value][it ? 1 : 0];
}

export default function AdminCrm() {
  const { language } = useApp();
  const it = language === "it";
  const locale = it ? "it-IT" : "en-GB";
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<CrmSegment>("all");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, setList] = useState<CrmList | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmDetail | null>(null);
  const [status, setStatus] = useState<CrmStatus>("none");
  const [followUpOn, setFollowUpOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ query, segment, page: String(page) });
    api<CrmList>(`admin/crm?${params}`)
      .then((result) => {
        if (!active) return;
        setList(result);
        setSelectedId((current) =>
          result.contacts.some((contact) => contact.id === current)
            ? current
            : (result.contacts[0]?.id ?? null),
        );
        setError("");
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [query, segment, page, version]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api<CrmDetail>(`admin/crm/contacts/${encodeURIComponent(selectedId)}`)
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setStatus(result.contact.status);
        setFollowUpOn(result.contact.followUpOn ?? "");
        setError("");
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [selectedId, version]);

  const selected = detail?.contact.id === selectedId ? detail : null;
  const date = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(value);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function saveFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`admin/crm/contacts/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        body: {
          status,
          followUpOn:
            status === "none" || status === "resolved" ? null : followUpOn,
        },
      });
      setVersion((value) => value + 1);
      setMessage(it ? "Promemoria aggiornato." : "Follow-up updated.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !note.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`admin/crm/contacts/${encodeURIComponent(selectedId)}/notes`, {
        method: "POST",
        body: { note: note.trim() },
      });
      setNote("");
      setVersion((value) => value + 1);
      setMessage(it ? "Nota aggiunta." : "Note added.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.crm}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>EVENTLY / CRM</span>
          <h1>{it ? "Relazioni" : "Relationships"}</h1>
          <p>
            {it
              ? "Contatti, attività e promemoria per partecipanti e organizzatori."
              : "Contacts, activity and follow-ups for attendees and organizers."}
          </p>
        </div>
        <span className={styles.privateTag}>
          {it ? "SOLO AMMINISTRATORI" : "ADMIN ONLY"}
        </span>
      </header>

      {(error || message) && (
        <p
          className={error ? styles.error : styles.message}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}

      <section
        className={styles.summary}
        aria-label={it ? "Riepilogo CRM" : "CRM summary"}
      >
        {(
          [
            ["all", it ? "Contatti" : "Contacts", list?.counts.total],
            [
              "attendees",
              it ? "Partecipanti" : "Attendees",
              list?.counts.attendees,
            ],
            [
              "organizers",
              it ? "Organizzatori" : "Organizers",
              list?.counts.organizers,
            ],
            ["due", it ? "Da seguire" : "Due now", list?.counts.due],
          ] as const
        ).map(([value, label, number]) => (
          <button
            key={value}
            className={styles.summaryCard}
            data-active={segment === value}
            onClick={() => {
              setSegment(value);
              setPage(1);
            }}
            type="button"
          >
            <span>{label}</span>
            <strong>{number ?? "—"}</strong>
          </button>
        ))}
      </section>

      <section
        className={styles.board}
        aria-label={it ? "Contatti CRM" : "CRM contacts"}
      >
        <div className={styles.directory}>
          <div className={styles.directoryHead}>
            <div>
              <span className={styles.eyebrow}>01 / DIRECTORY</span>
              <h2>{it ? "Contatti" : "Contacts"}</h2>
            </div>
            <span>{list?.filteredTotal ?? 0}</span>
          </div>
          <form className={styles.search} onSubmit={submitSearch}>
            <FiSearch aria-hidden="true" />
            <input
              aria-label={
                it ? "Cerca per nome o email" : "Search by name or email"
              }
              placeholder={it ? "Cerca nome o email" : "Search name or email"}
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">{it ? "Cerca" : "Search"}</button>
          </form>
          <div
            className={styles.filters}
            aria-label={it ? "Filtra contatti" : "Filter contacts"}
          >
            {segments.map((item) => (
              <button
                key={item.value}
                type="button"
                data-active={segment === item.value}
                onClick={() => {
                  setSegment(item.value);
                  setPage(1);
                }}
              >
                {it ? item.it : item.en}
              </button>
            ))}
          </div>
          <div className={styles.contactList}>
            {!list ? (
              <p className={styles.empty}>
                {it ? "Caricamento contatti…" : "Loading contacts…"}
              </p>
            ) : list.contacts.length ? (
              list.contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className={styles.contactRow}
                  data-active={selectedId === contact.id}
                  onClick={() => {
                    setDetail(null);
                    setNote("");
                    setMessage("");
                    setSelectedId(contact.id);
                  }}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {contact.name.trim().slice(0, 1).toUpperCase() || "?"}
                  </span>
                  <span className={styles.contactIdentity}>
                    <strong>{contact.name}</strong>
                    <small>{contact.email}</small>
                    <em>
                      {contact.isOrganizer
                        ? it
                          ? "Organizzatore"
                          : "Organizer"
                        : it
                          ? "Partecipante"
                          : "Attendee"}
                    </em>
                  </span>
                  {contact.followUpOn && contact.status !== "resolved" && (
                    <span className={styles.followDate}>
                      {contact.followUpOn}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <p className={styles.empty}>
                {it ? "Nessun contatto trovato." : "No contacts found."}
              </p>
            )}
          </div>
          {list && list.filteredTotal > list.pageSize && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                aria-label={it ? "Pagina precedente" : "Previous page"}
              >
                <FiArrowLeft />
              </button>
              <span>
                {page} / {Math.ceil(list.filteredTotal / list.pageSize)}
              </span>
              <button
                type="button"
                disabled={page * list.pageSize >= list.filteredTotal}
                onClick={() => setPage((value) => value + 1)}
                aria-label={it ? "Pagina successiva" : "Next page"}
              >
                <FiArrowRight />
              </button>
            </div>
          )}
        </div>

        <div className={styles.profile}>
          {!selected ? (
            <div className={styles.profileEmpty}>
              {selectedId
                ? it
                  ? "Caricamento profilo…"
                  : "Loading profile…"
                : it
                  ? "Seleziona un contatto."
                  : "Select a contact."}
            </div>
          ) : (
            <>
              <div className={styles.profileHead}>
                <div>
                  <span className={styles.eyebrow}>02 / CONTACT RECORD</span>
                  <h2>{selected.contact.name}</h2>
                  <span className={styles.role}>
                    {selected.contact.isOrganizer
                      ? it
                        ? "Organizzatore"
                        : "Organizer"
                      : it
                        ? "Partecipante"
                        : "Attendee"}
                  </span>
                </div>
                <a
                  href={`mailto:${selected.contact.email}`}
                  className={styles.emailLink}
                >
                  <FiMail aria-hidden="true" /> {it ? "Email" : "Email"}
                </a>
              </div>
              <p className={styles.profileEmail}>
                {selected.contact.email} · {it ? "Iscritto" : "Joined"}{" "}
                {date(selected.contact.createdAt)}
              </p>
              <div className={styles.activityMetrics}>
                <div>
                  <strong>{selected.contact.ticketsBooked}</strong>
                  <span>{it ? "Biglietti prenotati" : "Tickets booked"}</span>
                </div>
                <div>
                  <strong>{selected.contact.eventsPublished}</strong>
                  <span>{it ? "Eventi pubblicati" : "Events published"}</span>
                </div>
              </div>

              <form className={styles.followForm} onSubmit={saveFollowUp}>
                <div className={styles.sectionTitle}>
                  <FiCalendar aria-hidden="true" />
                  <h3>{it ? "Promemoria" : "Follow-up"}</h3>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    {it ? "Stato" : "Status"}
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as CrmStatus)
                      }
                    >
                      {(["none", "open", "waiting", "resolved"] as const).map(
                        (value) => (
                          <option key={value} value={value}>
                            {statusLabel(value, it)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    {it ? "Data" : "Date"}
                    <input
                      type="date"
                      value={
                        status === "none" || status === "resolved"
                          ? ""
                          : followUpOn
                      }
                      disabled={status === "none" || status === "resolved"}
                      onChange={(event) => setFollowUpOn(event.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" disabled={busy}>
                  {it ? "Salva promemoria" : "Save follow-up"}
                </button>
              </form>

              <section className={styles.notes}>
                <div className={styles.sectionTitle}>
                  <FiPlus aria-hidden="true" />
                  <h3>{it ? "Note private" : "Private notes"}</h3>
                  <span>{selected.notes.length}</span>
                </div>
                <form onSubmit={addNote}>
                  <label className={styles.srOnly} htmlFor="crm-note">
                    {it ? "Nuova nota" : "New note"}
                  </label>
                  <textarea
                    id="crm-note"
                    value={note}
                    maxLength={2000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      it
                        ? "Aggiungi contesto utile per il team…"
                        : "Add context for the team…"
                    }
                    rows={3}
                  />
                  <button
                    type="submit"
                    disabled={busy || note.trim().length < 2}
                  >
                    {it ? "Aggiungi nota" : "Add note"}
                  </button>
                </form>
                {selected.notes.length ? (
                  <div className={styles.noteList}>
                    {selected.notes.map((item) => (
                      <article key={item.id} className={styles.note}>
                        <p>{item.body}</p>
                        <small>
                          {item.authorName ?? "Admin"} · {date(item.createdAt)}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.empty}>
                    {it
                      ? "Nessuna nota per questo contatto."
                      : "No notes for this contact yet."}
                  </p>
                )}
              </section>

              {(selected.bookings.length > 0 || selected.events.length > 0) && (
                <section className={styles.recent}>
                  <div className={styles.sectionTitle}>
                    <h3>{it ? "Attività recente" : "Recent activity"}</h3>
                  </div>
                  {selected.bookings.map((booking) => (
                    <div key={booking.id} className={styles.activityRow}>
                      <span>{booking.eventTitle}</span>
                      <small>
                        {booking.status} · {date(booking.createdAt)}
                      </small>
                    </div>
                  ))}
                  {selected.events.map((event) => (
                    <div key={event.id} className={styles.activityRow}>
                      <span>{event.title}</span>
                      <small>{event.visibility}</small>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
