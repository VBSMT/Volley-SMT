"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p className="notice" role="status">
        Si cette adresse est celle d&apos;un adhérent, un lien de connexion vient d&apos;être
        envoyé. Ouvrez-le depuis ce téléphone.
      </p>
    );
  }

  return (
    <form action={formAction} className="stack">
      {linkError && (
        <p className="error" role="alert">
          Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.
        </p>
      )}
      <label htmlFor="email">Votre adresse email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      {state.status === "error" && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
    </form>
  );
}
