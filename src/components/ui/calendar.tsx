"use client";

import * as React from "react";
import {DayPicker} from "react-day-picker";

import {cn} from "cn";

function Calendar({className, classNames, ...props}: React.ComponentProps<typeof DayPicker>): React.ReactElement {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays
      fixedWeeks
      navLayout="after"
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "space-y-4",
        month_caption: "relative flex h-9 items-center justify-center px-10",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-3 top-3 flex items-center justify-between",
        button_previous: "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-50",
        button_next: "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-50",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-medium",
        weeks: "mt-2",
        week: "flex w-full",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button: "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] aria-selected:bg-[var(--charcoal)] aria-selected:text-[var(--ivory)]",
        today: "font-semibold underline underline-offset-2",
        outside: "text-[var(--line)]",
        disabled: "opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

export {Calendar};
