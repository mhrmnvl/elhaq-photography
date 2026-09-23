"use client";

import type * as React from "react";

import {ErrorState} from "@/components/data-state";

export default function AlbumError({reset}: {error: Error & {digest?: string}; reset: () => void}): React.ReactElement {
  return <ErrorState title="Something went wrong" description="The album could not be loaded." retry={reset} retryLabel="Try again" />;
}
