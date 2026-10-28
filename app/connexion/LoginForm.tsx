"use client";

import { useActionState } from "react";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [sendState, sendAction, sending] = useActionState(sendMagicLink, initialState);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, initialState);

  if (sendState.status === "sent") {
    return (
      <form action={codeAction} className="stack">
        <p className="notice" role="status">
          Si cette adresse est celle d&apos;un adhérent, un email vient d&apos;être envoyé. Saisissez
          le code qu&apos;il contient, ou ouvrez le lien depuis ce téléphone.
        </p>
        <input type="hidden" name="email" value={sendState.email} />
        <label htmlFor="code">Code reçu par email</label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,12}"
          required
        />
        {codeState.message && (
          <p className="error" role="alert">
            {codeState.message}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={verifying}>
          {verifying ? "Vérification…" : "Me connecter"}
        </button>
      </form>
    );
  }

  return (
    <form action={sendAction} className="stack">
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
      {sendState.status === "error" && (
        <p className="error" role="alert">
          {sendState.message}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={sending}>
        {sending ? "Envoi…" : "Recevoir mon code de connexion"}
      </button>
    </form>
  );
}
