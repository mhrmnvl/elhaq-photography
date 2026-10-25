"use client";

import * as React from "react";
import {CalendarDays} from "lucide-react";
import {enUS, id as indonesia} from "react-day-picker/locale";

import {Button} from "@/components/ui/button";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import type {Locale} from "@/lib/domain";

export function dateFromInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return undefined;

  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

export function dateToInputValue(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DatePickerProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  clearLabel: string;
  invalid?: boolean;
  describedBy?: string;
};

export function DatePicker({id, name, value, onChange, locale, clearLabel, invalid, describedBy}: DatePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const date = dateFromInputValue(value);
  const displayValue = date ? new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {dateStyle: "long"}).format(date) : "";

  const selectDate = (selected: Date | undefined): void => {
    onChange(dateToInputValue(selected));
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            data-empty={!date}
            data-form-control
            className="h-9 w-full justify-between rounded-md border-[var(--line)] bg-transparent px-3 py-1.5 text-left font-normal text-sm data-[empty=true]:text-muted-foreground"
          >
            <span className="truncate">{displayValue}</span>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className="w-fit max-w-[calc(100vw-1rem)] gap-0 rounded-lg border border-[var(--line)]/30 bg-popover p-0 shadow-md">
          <Calendar
            mode="single"
            selected={date}
            locale={locale === "id" ? indonesia : enUS}
            onSelect={selectDate}
            className="p-3 [--cell-size:2rem] [--cell-radius:0.375rem]"
          />
          {date ? (
            <div className="border-t border-border/40 p-1.5">
              <Button type="button" variant="ghost" className="h-7 min-h-0 w-full justify-center rounded-md text-xs font-normal text-muted-foreground hover:text-foreground" onClick={() => selectDate(undefined)}>
                {clearLabel}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={value} />
    </>
  );
}
