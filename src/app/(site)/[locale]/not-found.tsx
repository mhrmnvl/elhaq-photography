import type * as React from "react";
import {getLocale, getTranslations} from "next-intl/server";

import {EmptyState} from "@/components/data-state";
import type {Locale} from "@/lib/domain";

export default async function NotFound(): Promise<React.ReactElement> {
  const locale = (await getLocale()) as Locale;
  const [state, actions] = await Promise.all([
    getTranslations({locale, namespace: "state"}),
    getTranslations({locale, namespace: "actions"}),
  ]);
  return <EmptyState title={state("notFoundTitle")} description={state("notFoundDescription")} action={{href: "/portfolio", label: actions("backToPortfolio")}} />;
}
