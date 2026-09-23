import type * as React from "react";

import {LoadingState} from "@/components/data-state";

export default function AlbumLoading(): React.ReactElement {
  return <LoadingState label="Loading album" />;
}
