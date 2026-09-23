"use client";

import type * as React from "react";

import {ErrorState} from "@/components/data-state";

export default function SettingsError({reset}: {error: Error & {digest?: string}; reset: () => void}): React.ReactElement {
  return <ErrorState title="Settings could not be loaded" description="Try again before editing the website content." retry={reset} retryLabel="Try again" />;
}
