import {expect, test} from "bun:test";

import {calendarDateFromIso, isoDateFromCalendarDate} from "@/components/ui/date-picker";

test("round-trips calendar dates without a timezone shift", () => {
  const date = calendarDateFromIso("2028-02-29");

  expect(date).toBeInstanceOf(Date);
  expect(isoDateFromCalendarDate(date)).toBe("2028-02-29");
});

test("ignores empty and malformed calendar values", () => {
  expect(calendarDateFromIso("")).toBeUndefined();
  expect(calendarDateFromIso("2027-02-29")).toBeUndefined();
  expect(isoDateFromCalendarDate(undefined)).toBe("");
});
