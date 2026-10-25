"use client";

import * as React from "react";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {FormErrorMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {privateLinkFormSchema, validateWithZod} from "@/lib/form-validation";
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
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const edit = (link: PrivateClientLink): void => {
    setEditingId(link.id);
    setForm({albumName: link.albumName, driveUrl: link.driveUrl});
    setErrors({});
  };

  const cancel = (): void => {
    setEditingId(null);
    setForm({albumName: "", driveUrl: ""});
    setErrors({});
  };

  const save = async (): Promise<void> => {
    if (pending) return;
    const validation = validateWithZod(privateLinkFormSchema, form);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/admin/private-links/${editingId}` : "/api/admin/private-links";
      const response = await fetch(url, {method, headers: {"content-type": "application/json"}, body: JSON.stringify(form)});
      const saved = await readResponse<PrivateClientLink>(response);
      setLinks((current) => editingId ? current.map((link) => link.id === saved.id ? saved : link) : [saved, ...current]);
      const message = editingId ? "Private link updated." : "Private link saved.";
      cancel();
      toast.success(message);
    } catch (requestError) {
      toast.error(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (pending || !window.confirm("Delete this private client link?")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/private-links/${id}`, {method: "DELETE"});
      await readResponse<{ok: true}>(response);
      setLinks((current) => current.filter((link) => link.id !== id));
      if (editingId === id) cancel();
      toast.success("Private link deleted.");
    } catch (requestError) {
      toast.error(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-8 pb-5">
      <header>
        <h1 className="break-words text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--charcoal)] m-0">Private client links</h1>
      </header>

      <form className="admin-form space-y-4 border-t border-[var(--line)]/25 pt-5" onSubmit={(event) => {event.preventDefault(); void save();}} noValidate>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--charcoal)] m-0">{editingId ? "Edit link" : "Add a link"}</h2>
        <div className="grid gap-1 max-w-xl">
          <div className="contact-field"><Input className="min-w-0 w-full" id="private-link-album-name" placeholder=" " value={form.albumName} onChange={(event) => {setForm({...form, albumName: event.currentTarget.value}); if (errors.albumName) setErrors((prev) => ({...prev, albumName: ""}));}} maxLength={200} aria-invalid={Boolean(errors.albumName)} aria-describedby={errors.albumName ? "private-link-album-name-error" : undefined} required /><Label className="contact-field__label" htmlFor="private-link-album-name">Album name</Label></div>
          <FormErrorMessage id="private-link-album-name-error" message={errors.albumName} />
        </div>
        <div className="grid gap-1 max-w-xl">
          <div className="contact-field"><Input className="min-w-0 w-full" id="private-link-drive-url" type="url" value={form.driveUrl} onChange={(event) => {setForm({...form, driveUrl: event.currentTarget.value}); if (errors.driveUrl) setErrors((prev) => ({...prev, driveUrl: ""}));}} placeholder="https://drive.google.com/..." aria-invalid={Boolean(errors.driveUrl)} aria-describedby={errors.driveUrl ? "private-link-drive-url-error" : undefined} required /><Label className="contact-field__label" htmlFor="private-link-drive-url">Google Drive URL</Label></div>
          <FormErrorMessage id="private-link-drive-url-error" message={errors.driveUrl} />
        </div>
        <footer className="mt-6 -mx-4 sm:-mx-5 border-t border-border px-4 py-2.5 sm:px-5 bg-background flex flex-wrap items-center gap-2.5">
          <Button size="sm" type="submit" disabled={pending}>{pending ? "Saving" : editingId ? "Save link" : "Add private link"}</Button>
          {editingId ? <Button size="sm" type="button" variant="outline" onClick={cancel} disabled={pending}>Cancel</Button> : null}
        </footer>
      </form>


      {links.length === 0 ? <p aria-live="polite">No private links have been saved yet.</p> : (
        <ul className="grid min-w-0 gap-4">
          {links.map((link) => (
            <li key={link.id} className="min-w-0 space-y-2.5 rounded-sm border border-[var(--line)]/25 bg-[var(--ivory)] p-5 shadow-2xs">
              <h2 className="min-w-0 break-words text-base sm:text-lg font-semibold tracking-tight text-[var(--charcoal)] m-0">{link.albumName}</h2>
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
