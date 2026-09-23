import type * as React from "react";
import {getTranslations} from "next-intl/server";

import {LoadingState} from "@/components/data-state";

export default async function Loading(): Promise<React.ReactElement> {
  const state = await getTranslations("state");
  return <LoadingState label={state("loading")} />;
}
