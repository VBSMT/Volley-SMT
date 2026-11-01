"use client";

import Link from "next/link";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { getBrowserClient } from "@/lib/supabase/browser";
import { deleteMessage, loadNewer, loadOlder, markRead, reportMessage, sendMessage, setRoomNotify, toggleReaction } from "../actions";
import { REACTIONS, type Reaction, type ReactionRow, reactionSummary } from "@/lib/domain/chat";

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
  mentionable,
  initial,
  notify: initialNotify,
  hasMore: initialHasMore,
}: {
  room: string;
  label: string;
  meId: string;
  isBoard: boolean;
  names: Record<string, string>;
  /** Membres ayant accès au salon : seuls eux peuvent être cités. */
  mentionable: string[];
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
  const lastRead = useRef(0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const keepScroll = useRef<number | null>(null);

  const [live, setLive] = useState(true);
  // Réactions des messages affichés (lues avec la RLS du salon) et barre de choix ouverte.
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [picker, setPicker] = useState<string | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ids = messages.map((m) => m.id).join(",");
  const loadReactions = useRef(() => {});
  loadReactions.current = () => {
    const list = ids ? ids.split(",") : [];
    if (!list.length) return setReactions([]);
    getBrowserClient()
      .from("chat_reactions")
      .select("message_id, member_id, emoji")
      .in("message_id", list)
      .then(({ data }: { data: { message_id: string; member_id: string; emoji: Reaction }[] | null }) =>
        setReactions((data ?? []).map((r) => ({ messageId: r.message_id, memberId: r.member_id, emoji: r.emoji }))),
      );
  };
  useEffect(() => loadReactions.current(), [ids]);
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
      loadReactions.current();
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reactions" }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const r = payload.new as unknown as { message_id: string; member_id: string; emoji: Reaction };
        setReactions((list) =>
          list.some((x) => x.messageId === r.message_id && x.memberId === r.member_id && x.emoji === r.emoji)
            ? list
            : [...list, { messageId: r.message_id, memberId: r.member_id, emoji: r.emoji }],
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_reactions" }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const r = payload.old as unknown as { message_id?: string; member_id?: string; emoji?: string };
        setReactions((list) => list.filter((x) => !(x.messageId === r.message_id && x.memberId === r.member_id && x.emoji === r.emoji)));
      })
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Réagir : ajoute ou retire sa réaction (affichage immédiat, annulé si refusé).
  const react = (messageId: string, emoji: Reaction) => {
    setPicker(null);
    const on = !reactions.some((r) => r.messageId === messageId && r.memberId === meId && r.emoji === emoji);
    const row = { messageId, memberId: meId, emoji };
    const apply = (add: boolean) =>
      setReactions((list) => (add ? [...list, row] : list.filter((x) => !(x.messageId === messageId && x.memberId === meId && x.emoji === emoji))));
    apply(on);
    toggleReaction(messageId, emoji, on).then((r) => {
      if (r.error) {
        apply(!on);
        setError(r.error);
      }
    });
  };
  // Appui long (ou clic droit) sur une bulle : barre des réactions.
  const longPress = (id: string) => ({
    onPointerDown: () => {
      press.current = setTimeout(() => setPicker(id), 450);
    },
    onPointerUp: () => press.current && clearTimeout(press.current),
    onPointerLeave: () => press.current && clearTimeout(press.current),
    onPointerMove: () => press.current && clearTimeout(press.current),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setPicker(id);
    },
  });

  // Défile vers le bas (sauf après « Messages précédents ») et marque comme lu (au plus toutes les 10 s).
  useEffect(() => {
    if (keepScroll.current !== null) {
      // Messages ajoutés en haut : on garde le même endroit à l'écran.
      window.scrollBy(0, document.documentElement.scrollHeight - keepScroll.current);
      keepScroll.current = null;
    } else window.scrollTo({ top: document.documentElement.scrollHeight }); // tout en bas, zone de saisie comprise
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
    const allowed = new Set(mentionable);
    return Object.entries(names)
      .filter(([id, n]) => id !== meId && allowed.has(id) && n.toLocaleLowerCase("fr").startsWith(q))
      .slice(0, 5);
  }, [mention, names, meId, mentionable]);

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
      {/* Bandeau collé en haut au défilement : retour, nom du salon, cloche. */}
      <div className="chat-head">
        <Link href="/chat" className="chat-back" aria-label="Retour aux messages">
          ←
        </Link>
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
              <div className={`chat-msg${mine ? " is-mine" : ""}`} {...longPress(m.id)}>
                {picker === m.id && (
                  <div className="chat-picker" role="group" aria-label="Réagir au message">
                    {REACTIONS.map((e) => (
                      <button key={e} type="button" onClick={() => react(m.id, e)} aria-label={`Réagir ${e}`}>
                        {e}
                      </button>
                    ))}
                    <button type="button" className="chat-picker-close" onClick={() => setPicker(null)} aria-label="Fermer">
                      ✕
                    </button>
                  </div>
                )}
                {!mine && <span className="chat-author">{(m.authorId && names[m.authorId]) || "Ancien adhérent"}</span>}
                <p className="chat-body">{m.body}</p>
                {reactionSummary(reactions, m.id, meId).length > 0 && (
                  <span className="chat-reactions">
                    {reactionSummary(reactions, m.id, meId).map((r) => {
                      const who = r.who.map((id) => (id === meId ? "toi" : names[id] ?? "?")).join(", ");
                      return (
                        <button
                          key={r.emoji}
                          type="button"
                          className={`chat-reaction${r.mine ? " is-mine" : ""}`}
                          title={who}
                          aria-label={`${r.emoji} ${r.count} : ${who}${r.mine ? " (toucher pour retirer la tienne)" : " (toucher pour réagir aussi)"}`}
                          onClick={() => react(m.id, r.emoji)}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            press.current = setTimeout(() => toast({ message: `${r.emoji} ${who}` }), 450);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toast({ message: `${r.emoji} ${who}` });
                          }}
                        >
                          {r.emoji} {r.count}
                        </button>
                      );
                    })}
                  </span>
                )}
                <span className="chat-meta">
                  {time(m.createdAt)}
                  <button type="button" className="chat-action" onClick={() => setPicker(picker === m.id ? null : m.id)}>
                    Réagir
                  </button>
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
