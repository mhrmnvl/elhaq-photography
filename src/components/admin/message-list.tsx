import type * as React from "react";
import Link from "next/link";

import {EmptyState} from "@/components/data-state";
import type {AdminContactMessageSummary} from "@/lib/domain";

function eventLabel(eventType: AdminContactMessageSummary["eventType"]): string {
  return eventType === "wedding" ? "Wedding" : eventType === "events" ? "Events" : "Other photography";
}

function statusLabel(status: AdminContactMessageSummary["notificationStatus"]): string {
  return status === "disabled" ? "Notification disabled" : status === "pending" ? "Notification pending" : status === "sent" ? "Notification sent" : "Notification failed";
}

export function MessageList({items}: {items: readonly AdminContactMessageSummary[]}): React.ReactElement {
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="No messages yet" description="Messages sent through the public contact form will appear here. Review website settings to confirm the contact details." action={{href: "/admin/settings", label: "Review website settings"}} />
      </div>
    );
  }

  return (
    <ul className="grid min-w-0 gap-4">
      {items.map((item) => (
        <li key={item.id} className="min-w-0 border border-[var(--line)] p-5">
          <Link className="block min-w-0 space-y-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]" href={`/admin/messages/${item.id}`}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
              <h2 className="min-w-0 break-words font-serif text-2xl">{item.name}</h2>
              <time className="min-w-0 break-words text-sm" dateTime={item.createdAt}>{item.createdAt}</time>
            </div>
            <p className="min-w-0 break-words">{eventLabel(item.eventType)}</p>
            <p className="min-w-0 break-words text-sm">{[item.email, item.whatsapp].filter((channel): channel is string => channel !== null).join(" · ") || "No reply channel"}</p>
            <p className="min-w-0 break-words text-sm">{statusLabel(item.notificationStatus)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
