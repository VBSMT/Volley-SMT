"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState, useTransition } from "react";
import { saveOnboarding } from "@/app/(app)/onboarding-actions";

type Step = { path: string; target: string | null; group: number; title: string; text: string; optional?: boolean };

/** Étapes du guide (cibles : attributs data-tour des pages). 5 groupes affichés en points de progression. */
const STEPS: Step[] = [
  { path: "/accueil", target: "install", group: 0, optional: true, title: "1. Installe l'appli", text: "Touche « Installer » : Volley SMT s'ajoute à ton écran d'accueil comme une vraie appli. Sur iPhone : Partager, puis « Sur l'écran d'accueil »." },
  { path: "/accueil", target: "notifications", group: 1, optional: true, title: "2. Active les notifications", text: "La veille de chaque entraînement, une question ou un rappel. Tu choisiras quoi recevoir dans ton profil." },
  { path: "/accueil", target: "profile", group: 2, title: "3. Complète ton profil", text: "Touche tes initiales pour ouvrir ton profil." },
  { path: "/profil", target: "positions", group: 2, title: "Tes postes", text: "Passe, Avant (2) à droite au filet, Avant (4) à gauche, ou Fond : ils servent à faire des équipes équilibrées à l'entraînement." },
  { path: "/profil", target: "contact", group: 2, title: "Téléphone et contact d'urgence", text: "Utiles au club en cas de besoin." },
  { path: "/profil", target: "image", group: 2, title: "Droit à l'image", text: "Coche si tu acceptes que le club publie des photos où tu apparais." },
  { path: "/profil", target: "save", group: 2, title: "Enregistre", text: "Touche « Enregistrer » pour garder tes postes, ton téléphone, ton contact d'urgence et ton choix pour les photos." },
  { path: "/profil", target: "fiche", group: 2, title: "Vérifie tes infos", text: "Nom, équipe(s), licence, cotisation. Une erreur ? Préviens le Bureau." },
  { path: "/profil", target: "notif-prefs", group: 2, title: "Tes notifications", text: "Choisis ce que tu reçois : entraînements, matchs de ton équipe, demandes de renfort." },
  { path: "/accueil", target: "next-session", group: 3, title: "4. Les entraînements", text: "Informe si tu viens, ou pas." },
  { path: "", target: null, group: 4, title: "5. C'est prêt ! 🏐", text: "Tu peux revoir ce guide à tout moment : Profil › Revoir le guide." },
];
const GROUPS = 5;

type Rect = { top: number; left: number; width: number; height: number };

export function GuidedTour({ initialStep, done }: { initialStep: number; done: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, STEPS.length - 1));
  const [hidden, setHidden] = useState(done);
  const [rect, setRect] = useState<Rect | null>(null);
  const [, startTransition] = useTransition();
  const current = STEPS[step];

  const go = useCallback(
    (next: number, finish = false) => {
      // Enregistrement en arrière-plan ; hors ligne, le guide continue quand même.
      startTransition(async () => {
        try {
          await saveOnboarding(next, finish);
        } catch {}
      });
      if (finish || next >= STEPS.length) return setHidden(true);
      setRect(null);
      setStep(next);
      const target = STEPS[next];
      if (target.path && target.path !== pathname) router.push(target.path);
    },
    [pathname, router],
  );

  // Reprise : une étape du profil alors qu'on est sur l'accueil → repartir de « touche tes initiales ».
  useEffect(() => {
    if (hidden) return;
    if (current.path === "/profil" && pathname === "/accueil") setStep(2);
    // Toucher ses initiales ouvre le profil : on enchaîne sur les postes.
    if (step === 2 && pathname === "/profil") setStep(3);
  }, [pathname, step, current.path, hidden]);

  // Repère la zone à mettre en surbrillance ; étape facultative absente (déjà installé, notifications actives) : sautée.
  useLayoutEffect(() => {
    if (hidden || !current.target || (current.path && current.path !== pathname)) return setRect(null);
    let tries = 0;
    let frame = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (!el) {
        if (++tries < 12) return void (frame = window.setTimeout(find, 150));
        if (current.optional) go(step + 1);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const measure = () => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      };
      measure();
      window.setTimeout(measure, 400);
      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);
      cleanup = () => {
        window.removeEventListener("scroll", measure);
        window.removeEventListener("resize", measure);
      };
    };
    let cleanup = () => {};
    find();
    return () => {
      window.clearTimeout(frame);
      cleanup();
    };
  }, [step, pathname, hidden, current, go]);

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHidden(true); // fermé pour cette fois, reproposé plus tard
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden]);

  if (hidden) return null;
  const centered = !current.target;
  if (!centered && !rect) return null;

  const pad = 6;
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true;
  const round = current.target === "profile";

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour-spot"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: round ? "50%" : 14,
          }}
        />
      ) : (
        <div className="tour-backdrop" />
      )}
      <div
        className={`tour-tip${centered ? " is-centered" : ""}`}
        style={rect ? (below ? { top: rect.top + rect.height + pad + 14 } : { bottom: window.innerHeight - rect.top + pad + 14 }) : undefined}
      >
        <div className="tour-dots" aria-label={`Étape ${current.group + 1} sur ${GROUPS}`}>
          {Array.from({ length: GROUPS }, (_, i) => (
            <i key={i} className={i === current.group ? "on" : i < current.group ? "done" : ""} />
          ))}
        </div>
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.text}</p>
        <div className="tour-actions">
          {centered ? (
            <span />
          ) : (
            <button type="button" className="tour-skip" onClick={() => go(step, true)}>
              Passer le guide
            </button>
          )}
          <button type="button" className="tour-next" autoFocus onClick={() => go(step + 1, step === STEPS.length - 1)}>
            {centered ? "C'est parti !" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Profil › « Revoir le guide » : repart de la première étape. */
export function RestartTourButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await saveOnboarding(0, false);
          router.push("/accueil");
          router.refresh();
        })
      }
    >
      Revoir le guide
    </button>
  );
}
