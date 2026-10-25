import type * as React from "react";

import {dmSans} from "@/app/fonts";
import "@/app/globals.css";

export default function RootLayout({children}: {children: React.ReactNode}): React.ReactElement {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
