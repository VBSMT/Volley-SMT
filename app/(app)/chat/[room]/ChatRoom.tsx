"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { getBrowserClient } from "@/lib/supabase/browser";
import { deleteMessage, loadNewer, loadOlder, markRead, reportMessage, sendMessage, setRoomNotify } from "../actions";

type Msg = { id: string; authorId: string | null; body: string; createdAt: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });

/** Salon de discussion : messages en temps réel, envoi, mentions, suppression / signalement, notification du salon. */
export function ChatRoom({
  room,
  label,
  meId,
  isBoard,
  names,
  initial,
  notify: initialNotify,
  hasMore: initialHasMore,
}: {
  room: string;
  label: string;
  meId: string;
  isBoard: boolean;
  names: Record<string, string>;
  initial: Msg[];
  notify: boolean;
  hasMore: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [notify, setNotify] = useState(initialNotify);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const bottom = useRef<HTMLDivElement>(null);
  const lastRead = useRef(0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const keepScroll = useRef<number | null>(null);

  const [live, setLive] = useState(true);
  const latest = useRef(messages);
  latest.current = messages;
  const add = (list: Msg[], more: Msg[]) => [...list, ...more.filter((m) => !list.some((x) => x.id === m.id))];

  // Secours si le temps réel est coupé : relève les nouveaux messages toutes les 15 s (onglet visible).
  useEffect(() => {
    if (live) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const list = latest.current;
      const last = list[list.length - 1]?.createdAt ?? new Date(0).toISOString();
      loadNewer(room, last)
        .then((more) => more.length && setMessages((l) => add(l, more)))
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, [live, room]);

  // Temps réel : nouveaux messages et suppressions du salon.
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`chat:${room}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${room}` }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const m = payload.new as unknown as { id: string; author_id: string | null; body: string; created_at: string };
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, { id: m.id, authorId: m.author_id, body: m.body, createdAt: m.created_at }]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const id = (payload.old as unknown as { id?: string }).id;
        if (id) setMessages((list) => list.filter((x) => x.id !== id));
      })
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Défile vers le bas (sauf après « Messages précédents ») et marque comme lu (au plus toutes les 10 s).
  useEffect(() => {
    if (keepScroll.current !== null) {
      // Messages ajoutés en haut : on garde le même endroit à l'écran.
      window.scrollBy(0, document.documentElement.scrollHeight - keepScroll.current);
      keepScroll.current = null;
    } else bottom.current?.scrollIntoView({ block: "end" });
    if (Date.now() - lastRead.current > 10_000 && document.visibilityState === "visible") {
      lastRead.current = Date.now();
      markRead(room).catch(() => {});
    }
  }, [messages.length, room]);

  // À l'ouverture du salon : tout en bas, sur les derniers messages (après le défilement de Next).
  useEffect(() => {
    const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    toBottom();
    const timers = [50, 250, 600].map((ms) => setTimeout(toBottom, ms));
    return () => timers.forEach(clearTimeout);
  }, [room]);

  // Suggestions de mention quand le dernier mot commence par « @ ».
  const mention = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1];
  const suggestions = useMemo(() => {
    if (mention === undefined) return [];
    const q = mention.toLocaleLowerCase("fr");
    return Object.entries(names)
      .filter(([id, n]) => id !== meId && n.toLocaleLowerCase("fr").startsWith(q))
      .slice(0, 5);
  }, [mention, names, meId]);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    startTransition(async () => {
      const r = await sendMessage(room, body);
      if (r.error) return setError(r.error);
      setError(undefined);
      setText("");
      // Affiché tout de suite, sans attendre le temps réel (doublon ignoré à son arrivée).
      if (r.message) setMessages((list) => add(list, [r.message!]));
    });
  };

  return (
    <div className="chat stack">
      {dialog}
      <div className="chat-head">
        <h1>{label}</h1>
        <button
          type="button"
          className={`chat-bell${notify ? " is-on" : ""}`}
          aria-pressed={notify}
          aria-label={notify ? "Notifications de ce salon activées" : "Notifications de ce salon désactivées"}
          onClick={() => {
            const next = !notify;
            setNotify(next);
            startTransition(async () => {
              const r = await setRoomNotify(room, next);
              if (r.error) {
                setNotify(!next);
                setError(r.error);
              } else toast({ message: next ? "Notifications du salon activées." : "Notifications du salon désactivées." });
            });
          }}
        >
          {notify ? "🔔" : "🔕"}
        </button>
      </div>

      {hasMore && messages.length > 0 && (
        <button
          type="button"
          className="btn-secondary chat-older"
          disabled={loadingOlder}
          onClick={async () => {
            setLoadingOlder(true);
            try {
              const r = await loadOlder(room, messages[0].createdAt);
              keepScroll.current = document.documentElement.scrollHeight;
              setMessages((list) => [...r.messages.filter((m) => !list.some((x) => x.id === m.id)), ...list]);
              setHasMore(r.hasMore);
            } catch {
              setError("Chargement impossible.");
            } finally {
              setLoadingOlder(false);
            }
          }}
        >
          {loadingOlder ? "Chargement…" : "↑ Messages précédents"}
        </button>
      )}
      {!hasMore && messages.length > 0 && <p className="muted small chat-start">Début de la conversation (messages conservés 30 jours).</p>}
      <ol className="chat-list" aria-live="polite">
        {messages.length === 0 && <li className="muted small chat-empty">Aucun message ces 30 derniers jours. Lancez la discussion !</li>}
        {messages.map((m, i) => {
          const mine = m.authorId === meId;
          const newDay = i === 0 || day(messages[i - 1].createdAt) !== day(m.createdAt);
          return (
            <li key={m.id} className="chat-item">
              {newDay && <p className="chat-day">{day(m.createdAt)}</p>}
              <div className={`chat-msg${mine ? " is-mine" : ""}`}>
                {!mine && <span className="chat-author">{(m.authorId && names[m.authorId]) || "Ancien adhérent"}</span>}
                <p className="chat-body">{m.body}</p>
                <span className="chat-meta">
                  {time(m.createdAt)}
                  {(mine || isBoard) && (
                    <button
                      type="button"
                      className="chat-action"
                      onClick={async () => {
                        if (!(await confirm("Supprimer ce message ?", { confirmLabel: "Supprimer" }))) return;
                        const r = await deleteMessage(m.id);
                        if (r.error) setError(r.error);
                        else setMessages((list) => list.filter((x) => x.id !== m.id));
                      }}
                    >
                      Supprimer
                    </button>
                  )}
                  {!mine && (
                    <button
                      type="button"
                      className="chat-action"
                      onClick={async () => {
                        if (!(await confirm("Signaler ce message au Bureau ?", { confirmLabel: "Signaler" }))) return;
                        const r = await reportMessage(m.id);
                        if (r.error) setError(r.error);
                        else toast({ message: "Message signalé au Bureau." });
                      }}
                    >
                      Signaler
                    </button>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={bottom} />

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {suggestions.length > 0 && (
          <div className="chat-suggest" role="listbox" aria-label="Citer quelqu'un">
            {suggestions.map(([id, n]) => (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => setText((t) => t.replace(/@([^\s@]*)$/, `@${n} `))}
              >
                @{n}
              </button>
            ))}
          </div>
        )}
        <label htmlFor="chat-text" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-text"
          rows={1}
          maxLength={1000}
          placeholder="Message… (@ pour citer quelqu'un)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="btn-primary chat-send" disabled={pending || !text.trim()}>
          Envoyer
        </button>
      </form>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
