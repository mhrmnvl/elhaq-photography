import type * as React from "react";

import {LoadingState} from "@/components/data-state";

export default function PrivateLinksLoading(): React.ReactElement {
  return <LoadingState label="Loading private links" />;
}
