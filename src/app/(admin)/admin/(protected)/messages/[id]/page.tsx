import type * as React from "react";
import {headers} from "next/headers";
import {notFound} from "next/navigation";

import {MessageDetail} from "@/components/admin/message-detail";
import {requireAdmin} from "@/lib/authz";
import {getContactMessage} from "@/server/admin-messages";

export const runtime = "nodejs";

export default async function MessagePage({params}: {params: Promise<{id: string}>}): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const message = await getContactMessage(actor, (await params).id);
  if (!message) notFound();
  return <MessageDetail message={message} />;
}
