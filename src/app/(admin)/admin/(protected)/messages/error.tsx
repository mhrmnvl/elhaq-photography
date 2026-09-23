"use client";

import type * as React from "react";

import {ErrorState} from "@/components/data-state";

export default function MessagesError({reset}: {error: Error & {digest?: string}; reset: () => void}): React.ReactElement {
  return <ErrorState title="Messages could not be loaded" description="Try again to load the saved enquiries." retry={reset} retryLabel="Try again" />;
}
