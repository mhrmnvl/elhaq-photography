"use client";

import * as React from "react";

import {Button} from "@/components/ui/button";
import type {PrivateClientLink} from "@/lib/domain";

type FormValues = {albumName: string; driveUrl: string};

export type PrivateLinkFormProps = {initialLinks: readonly PrivateClientLink[]};

class PrivateLinkRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & {code?: string};
  if (!response.ok) throw new PrivateLinkRequestError(payload.code ?? "PRIVATE_LINK_REQUEST_FAILED");
  return payload;
}

function messageFor(error: unknown): string {
  if (error instanceof PrivateLinkRequestError && error.code === "VALIDATION_FAILED") return "Enter an album name and an HTTPS Google Drive link.";
  return "The private link request could not be completed. Try again.";
}

export function PrivateLinkForm({initialLinks}: PrivateLinkFormProps): React.ReactElement {
  const [links, setLinks] = React.useState<PrivateClientLink[]>(() => [...initialLinks]);
  const [form, setForm] = React.useState<FormValues>({albumName: "", driveUrl: ""});
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const edit = (link: PrivateClientLink): void => {
    setEditingId(link.id);
    setForm({albumName: link.albumName, driveUrl: link.driveUrl});
    setError(null);
    setNotice(null);
  };

  const cancel = (): void => {
    setEditingId(null);
    setForm({albumName: "", driveUrl: ""});
    setError(null);
    setNotice(null);
  };

  const save = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/admin/private-links/${editingId}` : "/api/admin/private-links";
      const response = await fetch(url, {method, headers: {"content-type": "application/json"}, body: JSON.stringify(form)});
      const saved = await readResponse<PrivateClientLink>(response);
      setLinks((current) => editingId ? current.map((link) => link.id === saved.id ? saved : link) : [saved, ...current]);
      const message = editingId ? "Private link updated." : "Private link saved.";
      cancel();
      setNotice(message);
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (pending || !window.confirm("Delete this private client link?")) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/private-links/${id}`, {method: "DELETE"});
      await readResponse<{ok: true}>(response);
      setLinks((current) => current.filter((link) => link.id !== id));
      if (editingId === id) cancel();
      setNotice("Private link deleted.");
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm">Admin-only Google Drive destinations</p>
        <h1 className="break-words font-serif text-5xl">Private client links</h1>
        <p className="max-w-2xl">Store the name of a private album and its Google Drive link. The link is never included in public content.</p>
      </header>

      <form className="space-y-5 border-t border-[var(--line)] pt-5" onSubmit={(event) => {event.preventDefault(); void save();}}>
        <h2 className="font-serif text-3xl">{editingId ? "Edit link" : "Add a link"}</h2>
        <label className="grid min-w-0 max-w-xl gap-2" htmlFor="private-link-album-name">Album name<input className="min-w-0 w-full" id="private-link-album-name" value={form.albumName} onChange={(event) => setForm({...form, albumName: event.currentTarget.value})} maxLength={200} required /></label>
        <label className="grid min-w-0 max-w-xl gap-2" htmlFor="private-link-drive-url">Google Drive URL<input className="min-w-0 w-full" id="private-link-drive-url" type="url" value={form.driveUrl} onChange={(event) => setForm({...form, driveUrl: event.currentTarget.value})} placeholder="https://drive.google.com/..." required /></label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving" : editingId ? "Save link" : "Add private link"}</Button>
          {editingId ? <Button type="button" variant="outline" onClick={cancel} disabled={pending}>Cancel</Button> : null}
        </div>
      </form>

      {error ? <p role="alert" aria-live="polite">{error}</p> : null}
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}

      {links.length === 0 ? <p aria-live="polite">No private links have been saved yet.</p> : (
        <ul className="grid min-w-0 gap-4">
          {links.map((link) => (
            <li key={link.id} className="min-w-0 space-y-3 border border-[var(--line)] p-5">
              <h2 className="min-w-0 break-words font-serif text-2xl">{link.albumName}</h2>
              <a className="block break-all underline underline-offset-4" href={link.driveUrl} target="_blank" rel="noreferrer">Open Google Drive link</a>
              <time className="block min-w-0 break-words text-sm" dateTime={link.updatedAt}>Updated {link.updatedAt}</time>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => edit(link)} disabled={pending}>Edit</Button>
                <Button type="button" variant="outline" onClick={() => void remove(link.id)} disabled={pending}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
