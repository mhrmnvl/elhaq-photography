import type * as React from "react";

import {dmSans} from "@/app/fonts";
import {Toaster} from "@/components/ui/sonner";
import "@/app/globals.css";

export default function AdminLayout({children}: {children: React.ReactNode}): React.ReactElement {
  return (
    <html lang="en" className={`${dmSans.variable} admin-theme`}>
      <body className="bg-sidebar min-h-svh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
