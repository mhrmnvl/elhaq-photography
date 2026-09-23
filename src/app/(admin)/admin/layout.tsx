import type * as React from "react";

import "@/app/globals.css";

export default function AdminLayout({children}: {children: React.ReactNode}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
