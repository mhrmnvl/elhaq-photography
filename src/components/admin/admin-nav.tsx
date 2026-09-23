"use client";

import * as React from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/button";
import {authClient} from "@/lib/auth-client";

export function AdminNav({name}: {name: string | null}): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signOut = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Could not sign out. Try again.");
        return;
      }
      setOpen(false);
      router.push("/admin/login");
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link className="font-serif text-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]" href="/admin" onClick={() => setOpen(false)}>Elhaq Photography</Link>
        <button
          type="button"
          className="inline-flex min-h-11 items-center md:hidden"
          aria-expanded={open}
          aria-controls="admin-navigation"
          aria-label={open ? "Close menu" : "Menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
        <nav id="admin-navigation" aria-label="Admin navigation" className={open ? "flex basis-full flex-col gap-2 md:w-auto md:basis-auto md:flex-row md:items-center" : "hidden gap-2 md:flex md:items-center"}>
          <Link className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin" onClick={() => setOpen(false)}>Dashboard</Link>
          <Link className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/albums" onClick={() => setOpen(false)}>Albums</Link>
          <Link className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/settings" onClick={() => setOpen(false)}>Settings</Link>
          <Link className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/private-links" onClick={() => setOpen(false)}>Private links</Link>
          <Link className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/messages" onClick={() => setOpen(false)}>Messages</Link>
          <Button type="button" variant="outline" onClick={() => void signOut()} disabled={pending}>{pending ? "Signing out" : "Sign out"}</Button>
        </nav>
      </div>
      {name ? <p className="mx-auto max-w-6xl px-6 pb-3 text-sm">Signed in as {name}</p> : null}
      {error ? <p className="mx-auto max-w-6xl px-6 pb-3 text-sm" role="alert">{error}</p> : null}
    </header>
  );
}
