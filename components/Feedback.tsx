"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";

/* Confirmation des actions et message « c'est fait » avec bouton Annuler. */

type Toast = { id: number; message: string; undo?: () => Promise<{ error?: string }> };
const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Durée d'affichage du message (et donc de la possibilité d'annuler en un geste). */
const TOAST_MS = 8000;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const show = useCallback((t: Omit<Toast, "id">) => {
    setError(undefined);
    setToast({ ...t, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast || pending) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, pending]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{error ?? toast.message}</span>
            {toast.undo && !error && (
              <button
                type="button"
                className="toast-undo"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await toast.undo!();
                    if (r.error) setError(r.error);
                    else setToast({ id: Date.now(), message: "Action annulée." });
                  })
                }
              >
                {pending ? "…" : "Annuler"}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Fermer" onClick={() => setToast(undefined)}>
              ×
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Fenêtre de confirmation (vraie boîte de dialogue modale, accessible au clavier). */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ title: string; text?: string; confirmLabel: string; resolve: (ok: boolean) => void }>();

  const confirm = useCallback(
    (title: string, opts: { text?: string; confirmLabel?: string } = {}) =>
      new Promise<boolean>((resolve) => {
        setState({ title, text: opts.text, confirmLabel: opts.confirmLabel ?? "Confirmer", resolve });
        requestAnimationFrame(() => ref.current?.showModal());
      }),
    [],
  );

  const close = (ok: boolean) => {
    ref.current?.close();
    state?.resolve(ok);
    setState(undefined);
  };

  const dialog = (
    <dialog ref={ref} className="confirm-dialog" onCancel={() => close(false)} aria-labelledby="confirm-title">
      {state && (
        <div className="stack">
          <h2 id="confirm-title">{state.title}</h2>
          {state.text && <p>{state.text}</p>}
          <div className="action-row">
            <button type="button" className="btn-secondary" onClick={() => close(false)}>
              Retour
            </button>
            <button type="button" className="btn-primary" onClick={() => close(true)} autoFocus>
              {state.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return { confirm, dialog };
}
