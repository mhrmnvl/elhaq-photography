"use client";

import type * as React from "react";

import {ErrorState} from "@/components/data-state";

export default function AdminError({reset}: {error: Error & {digest?: string}; reset: () => void}): React.ReactElement {
  return <ErrorState title="Something went wrong" description="The admin page could not be loaded." retry={reset} retryLabel="Try again" />;
}
