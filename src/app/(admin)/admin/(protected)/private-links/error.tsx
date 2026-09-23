"use client";

import type * as React from "react";

import {ErrorState} from "@/components/data-state";

export default function PrivateLinksError({reset}: {error: Error & {digest?: string}; reset: () => void}): React.ReactElement {
  return <ErrorState title="Private links could not be loaded" description="Try again before managing a client link." retry={reset} retryLabel="Try again" />;
}
