import type * as React from "react";

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
    <article className="min-w-0 space-y-8 pb-5">
      <header className="space-y-3 border-b border-[var(--line)]/25 pb-5">
        <p className="text-sm text-[var(--charcoal)]/75">{eventLabel(message.eventType)}</p>
        <h1 className="min-w-0 break-words text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--charcoal)]">{message.name}</h1>
        <time className="block min-w-0 break-words text-sm text-[var(--charcoal)]/70" dateTime={message.createdAt}>{message.createdAt}</time>
        <p className="text-sm font-medium">{statusLabel(message.notificationStatus)}</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--charcoal)]">Contact details</h2>
        {message.email ? <p className="min-w-0 break-words"><a className="inline-flex min-h-11 max-w-full min-w-0 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`mailto:${encodeURIComponent(message.email)}`}><span className="min-w-0 break-all">{message.email}</span></a></p> : null}
        {message.whatsapp && whatsappDigits ? <p className="min-w-0 break-words"><a className="inline-flex min-h-11 max-w-full min-w-0 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><span>WhatsApp </span><span className="min-w-0 break-all">{message.whatsapp}</span></a></p> : null}
        {message.eventDate ? <p className="min-w-0 break-words">Event date: {message.eventDate.slice(0, 10)}</p> : null}
        {message.eventLocation ? <p className="min-w-0 break-words">Event location: {message.eventLocation}</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--charcoal)]">Message</h2>
        <p className="min-w-0 max-w-3xl break-words whitespace-pre-wrap rounded-sm border border-[var(--line)]/25 bg-[var(--ivory)] p-4 leading-relaxed">{message.message}</p>
      </section>
    </article>
  );
}
