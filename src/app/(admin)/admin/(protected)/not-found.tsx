import type * as React from "react";
import Link from "next/link";

export default function AdminNotFound(): React.ReactElement {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-4xl">Album not found</h1>
      <p>The album may have been removed.</p>
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/albums">Return to albums</Link>
    </section>
  );
}
