import { CloseButtons, OfferButton } from "@/components/ReinforcementActions";
import { wantedLabel } from "@/lib/domain/notifications";
import { formatDay, formatTime } from "@/lib/format";
import type { ReinforcementView } from "@/lib/reinforcements";

export function ReinforcementCard({ request: r, myTeamIds }: { request: ReinforcementView; myTeamIds: string[] }) {
  const wanted = wantedLabel(r.sex, r.position);
  return (
    <li className="card stack reinforcement">
      <div className="session-head">
        <h3>{r.teamName} cherche un renfort</h3>
        <span className={r.match.isHome ? "badge home" : "badge away"}>{r.match.isHome ? "Dom." : "Ext."}</span>
      </div>
      <p>
        <strong>{wanted.replace(/^./, (c) => c.toUpperCase())}</strong>
        <br />
        <span className="match-date-inline">
          {formatDay(r.match.startsAt)} à {formatTime(r.match.startsAt)}
        </span>{" "}
        contre {r.match.opponent}
        {!r.match.isHome && (r.match.venue || r.match.city) && (
          <span className="muted small"> · {[r.match.venue, r.match.city].filter(Boolean).join(", ")}</span>
        )}
      </p>
      {r.note && <p className="quote">« {r.note} »</p>}

      {r.canManage ? (
        <>
          <div>
            <h4>Volontaires{r.offers!.length ? ` (${r.offers!.length})` : ""}</h4>
            {r.offers!.length ? (
              <ol className="volunteers">
                {r.offers!.map((o) => (
                  <li key={o.memberId}>
                    {o.name}{" "}
                    <span className="muted small">
                      · {formatDay(o.at)} {formatTime(o.at)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">Pas encore de proposition.</p>
            )}
          </div>
          <CloseButtons requestId={r.id} />
        </>
      ) : myTeamIds.includes(r.teamId) ? (
        <p className="muted small">Demande de votre équipe.</p>
      ) : (
        <OfferButton requestId={r.id} offered={r.myOffer} />
      )}
    </li>
  );
}
