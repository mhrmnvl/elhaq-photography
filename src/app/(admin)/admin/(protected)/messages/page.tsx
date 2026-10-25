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
    <section className="space-y-6 pb-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--charcoal)] m-0">Messages</h1>
      </header>
      <MessageList items={messages} />
    </section>
  );
}
