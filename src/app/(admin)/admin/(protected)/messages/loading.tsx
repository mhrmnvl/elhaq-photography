import type * as React from "react";

import {LoadingState} from "@/components/data-state";

export default function MessagesLoading(): React.ReactElement {
  return <LoadingState label="Loading messages" />;
}
