import type * as React from "react";

import {LoadingState} from "@/components/data-state";

export default function AdminLoading(): React.ReactElement {
  return <LoadingState label="Loading admin" />;
}
