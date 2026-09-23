"use client";

import type * as React from "react";
import {useTranslations} from "next-intl";

import {ErrorState} from "@/components/data-state";

type ErrorProps = {error: Error & {digest?: string}; reset: () => void};

export default function Error({reset}: ErrorProps): React.ReactElement {
  const state = useTranslations("state");
  const actions = useTranslations("actions");
  return <ErrorState title={state("errorTitle")} description={state("errorDescription")} retry={reset} retryLabel={actions("retry")} />;
}
