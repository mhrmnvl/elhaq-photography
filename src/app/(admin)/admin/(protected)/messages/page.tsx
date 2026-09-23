import type * as React from "react";
import {headers} from "next/headers";

import {MessageList} from "@/components/admin/message-list";
import {requireAdmin} from "@/lib/authz";
import {listContactMessages} from "@/server/admin-messages";

export const runtime = "nodejs";

export default async function MessagesPage(): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const messages = await listContactMessages(actor);
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm">Public contact form</p>
        <h1 className="font-serif text-5xl">Messages</h1>
        <p className="max-w-2xl">Read saved enquiries and reply through the contact channel they provided.</p>
      </header>
      <MessageList items={messages} />
    </section>
  );
}
