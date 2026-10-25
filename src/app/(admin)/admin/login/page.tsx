"use client";

import * as React from "react";

import {Button} from "@/components/ui/button";
import {authClient} from "@/lib/auth-client";

export default function AdminLoginPage(): React.ReactElement {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signIn = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({provider: "google", callbackURL: "/admin"});
      if (result.error) setError("Google sign-in could not be started. Try again.");
    } catch {
      setError("Google sign-in could not be started. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-wider font-semibold text-[var(--charcoal)]/50">Elhaq Photography</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--charcoal)] leading-tight">Admin sign in</h1>
      <p className="mt-3 text-sm text-[var(--charcoal)]/70 max-w-md leading-relaxed">Sign in with the approved Google account to manage albums.</p>
      <div className="mt-6">
        <Button type="button" onClick={() => void signIn()} disabled={pending} className="px-6">{pending ? "Opening Google sign-in" : "Sign in with Google"}</Button>
      </div>
      {error ? <p className="mt-4 text-xs text-destructive" role="alert">{error}</p> : null}
    </main>
  );
}
