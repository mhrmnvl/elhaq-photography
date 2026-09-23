"use client";

import * as React from "react";
import {format, isValid, parseISO} from "date-fns";
import {enUS} from "date-fns/locale/en-US";
import {id as idLocale} from "date-fns/locale/id";
import {CalendarDays} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {cn} from "cn";

type DatePickerLocale = "en" | "id";

function calendarDateFromIso(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : undefined;
}

function isoDateFromCalendarDate(date: Date | undefined): string {
  return date && isValid(date) ? format(date, "yyyy-MM-dd") : "";
}

export type DatePickerProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  locale?: DatePickerLocale;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
};

export function DatePicker({id, name, value, onChange, locale = "en", placeholder, disabled, required, className, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy}: DatePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const selected = calendarDateFromIso(value);
  const dateLocale = locale === "id" ? idLocale : enUS;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            aria-haspopup="dialog"
            data-empty={!selected}
            className={cn("min-h-11 w-full justify-start border-[var(--line)] bg-transparent text-left font-normal", !selected && "text-[var(--charcoal)]", className)}
          >
            <CalendarDays aria-hidden="true" />
            {selected ? format(selected, "PPP", {locale: dateLocale}) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(isoDateFromCalendarDate(date));
              setOpen(false);
            }}
            locale={dateLocale}
            defaultMonth={selected}
            aria-label={placeholder}
          />
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
    </>
  );
}

export {calendarDateFromIso, isoDateFromCalendarDate};
