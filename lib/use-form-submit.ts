"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Envoie un formulaire à une action de useActionState sans la remise à zéro automatique
 * de React 19 (attribut `action`) : les valeurs saisies restent affichées après l'envoi.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  };
}
