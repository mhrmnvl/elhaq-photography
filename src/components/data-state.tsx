"use client";

import type * as React from "react";

import NextLink from "next/link";
import {Button} from "@/components/ui/button";
import {Link as LocaleLink} from "@/i18n/navigation";

type Action = {href: string; label: string};

export function LoadingState({label}: {label: string}): React.ReactElement {
  return <p role="status" aria-live="polite">{label}</p>;
}

export function EmptyState({title, description, action}: {title: string; description: string; action?: Action}): React.ReactElement {
  const actionClassName = "inline-flex h-9 items-center underline underline-offset-4";
  return (
    <section aria-live="polite" className="space-y-3">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? action.href.startsWith("/admin") ? <NextLink className={actionClassName} href={action.href}>{action.label}</NextLink> : <LocaleLink className={actionClassName} href={action.href}>{action.label}</LocaleLink> : null}
    </section>
  );
}

export function ErrorState({title, description, retry, retryLabel}: {title: string; description: string; retry: () => void; retryLabel: string}): React.ReactElement {
  return (
    <section role="alert" className="space-y-3">
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="ghost" className="h-auto p-0 underline underline-offset-4" type="button" onClick={retry}>{retryLabel}</Button>
    </section>
  );
}
