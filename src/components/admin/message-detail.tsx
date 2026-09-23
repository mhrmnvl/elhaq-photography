import type * as React from "react";
import Link from "next/link";

import type {AdminContactMessage} from "@/lib/domain";

function eventLabel(eventType: AdminContactMessage["eventType"]): string {
  return eventType === "wedding" ? "Wedding" : eventType === "events" ? "Events" : "Other photography";
}

function statusLabel(status: AdminContactMessage["notificationStatus"]): string {
  return status === "disabled" ? "Notification disabled" : status === "pending" ? "Notification pending" : status === "sent" ? "Notification sent" : "Notification failed";
}

export function MessageDetail({message}: {message: AdminContactMessage}): React.ReactElement {
  const whatsappDigits = message.whatsapp?.replace(/\D/g, "") ?? "";
  return (
    <article className="min-w-0 space-y-8">
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/admin/messages">Back to messages</Link>
      <header className="space-y-3 border-b border-[var(--line)] pb-5">
        <p className="text-sm">{eventLabel(message.eventType)}</p>
        <h1 className="min-w-0 break-words font-serif text-5xl">{message.name}</h1>
        <time className="block min-w-0 break-words text-sm" dateTime={message.createdAt}>{message.createdAt}</time>
        <p>{statusLabel(message.notificationStatus)}</p>
      </header>
      <section className="space-y-3">
        <h2 className="font-serif text-3xl">Contact details</h2>
        {message.email ? <p className="min-w-0 break-words"><a className="inline-flex min-h-11 max-w-full min-w-0 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`mailto:${encodeURIComponent(message.email)}`}><span className="min-w-0 break-all">{message.email}</span></a></p> : null}
        {message.whatsapp && whatsappDigits ? <p className="min-w-0 break-words"><a className="inline-flex min-h-11 max-w-full min-w-0 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><span>WhatsApp </span><span className="min-w-0 break-all">{message.whatsapp}</span></a></p> : null}
        {message.eventDate ? <p className="min-w-0 break-words">Event date: {message.eventDate.slice(0, 10)}</p> : null}
        {message.eventLocation ? <p className="min-w-0 break-words">Event location: {message.eventLocation}</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-3xl">Message</h2>
        <p className="min-w-0 max-w-3xl break-words whitespace-pre-wrap">{message.message}</p>
      </section>
    </article>
  );
}
