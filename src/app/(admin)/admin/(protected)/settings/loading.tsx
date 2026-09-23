import type * as React from "react";

import {LoadingState} from "@/components/data-state";

export default function SettingsLoading(): React.ReactElement {
  return <LoadingState label="Loading website settings" />;
}
