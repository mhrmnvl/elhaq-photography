import type * as React from "react";

export function EditorialSection({title, description}: {title: string; description: string}): React.ReactElement {
  return (
    <section className="border-t border-[var(--line)] px-6 py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16">
        <h2 className="text-3xl leading-tight md:text-5xl">{title}</h2>
        <p className="max-w-2xl text-lg leading-8">{description}</p>
      </div>
    </section>
  );
}
