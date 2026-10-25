"use client";

import * as React from "react";
import {useTranslations} from "next-intl";

import {DatePicker} from "@/components/ui/date-picker";
import {Button} from "@/components/ui/button";
import {FormErrorMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {parseContactInput} from "@/lib/contact-validation";
import type {Locale} from "@/lib/domain";

export type ContactResponse =
  | {ok: true; confirmation: "saved"; duplicate: boolean}
  | {ok: false; code: "VALIDATION_FAILED"; fieldErrors: Record<string, string[]>}
  | {ok: false; code: "INVALID_JSON" | "BODY_TOO_LARGE" | "IDEMPOTENCY_PAYLOAD_MISMATCH" | "RATE_LIMITED" | "MESSAGE_NOT_SAVED"; retryAfterSeconds?: number};

export type ContactMessages = {
  saved: string;
  rateLimited: string;
  validation: string;
  requiredChannel: string;
  conflict: string;
  newEnquiry: string;
  retry: string;
};

export type ContactStatus = {kind: "saved" | "error" | "conflict"; message: string; actionLabel?: string};

export type ContactResponseMapping = {status: ContactStatus; fieldErrors: Record<string, string[]>};

export function mapContactResponse(statusCode: number, payload: ContactResponse, messages: ContactMessages): ContactResponseMapping {
  if (statusCode >= 200 && statusCode < 300 && payload.ok) {
    return {fieldErrors: {}, status: {kind: "saved", message: messages.saved}};
  }

  if (!payload.ok && payload.code === "VALIDATION_FAILED") {
    const fieldErrors = Object.fromEntries(Object.entries(payload.fieldErrors).map(([field, errors]) => [
      field,
      [errors.some((error) => error.includes("Email or WhatsApp")) ? messages.requiredChannel : messages.validation],
    ]));
    return {fieldErrors, status: {kind: "error", message: messages.validation}};
  }

  if (!payload.ok && payload.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
    return {fieldErrors: {}, status: {kind: "conflict", message: messages.conflict, actionLabel: messages.newEnquiry}};
  }

  if (!payload.ok && payload.code === "RATE_LIMITED") {
    return {fieldErrors: {}, status: {kind: "error", message: messages.rateLimited}};
  }

  return {fieldErrors: {}, status: {kind: "error", message: messages.retry}};
}

type Values = {name: string; email: string; whatsapp: string; eventType: "wedding" | "events" | "other"; eventDate: string; eventLocation: string; message: string};

const emptyValues: Values = {name: "", email: "", whatsapp: "", eventType: "wedding", eventDate: "", eventLocation: "", message: ""};

export function ContactForm({locale}: {locale: Locale}): React.ReactElement {
  const t = useTranslations();
  const [values, setValues] = React.useState<Values>(emptyValues);
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<ContactStatus | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const submissionKey = React.useRef<string | null>(null);
  const messages: ContactMessages = {
    saved: t("contact.saved"),
    rateLimited: t("contact.rateLimited"),
    validation: t("contact.validation"),
    requiredChannel: t("contact.requiredChannel"),
    conflict: t("contact.conflict"),
    newEnquiry: t("contact.newEnquiry"),
    retry: t("actions.retry"),
  };

  const updateValue = <K extends keyof Values>(key: K, value: Values[K]): void => {
    setValues((prev) => ({...prev, [key]: value}));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = {...prev};
        delete next[key];
        return next;
      });
    }
  };

  const resetForNewEnquiry = (): void => {
    setFieldErrors({});
    setStatus(null);
    submissionKey.current = crypto.randomUUID();
  };

  const submit = async (): Promise<void> => {
    if (pending) return;
    submissionKey.current ??= crypto.randomUUID();

    // Client-side Zod validation before sending network request
    const clientValidation = parseContactInput({...values, submissionKey: submissionKey.current});
    if (!clientValidation.ok) {
      const mapped = mapContactResponse(400, {ok: false, code: "VALIDATION_FAILED", fieldErrors: clientValidation.fieldErrors}, messages);
      setFieldErrors(mapped.fieldErrors);
      setStatus(mapped.status);
      return;
    }

    setPending(true);
    setStatus(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({...values, submissionKey: submissionKey.current}),
      });
      const payload = await response.json() as ContactResponse;
      const mapped = mapContactResponse(response.status, payload, messages);
      if (mapped.status.kind === "saved") {
        setStatus(mapped.status);
        setValues(emptyValues);
        submissionKey.current = crypto.randomUUID();
      } else {
        setFieldErrors(mapped.fieldErrors);
        setStatus(mapped.status);
      }
    } catch {
      setStatus({kind: "error", message: messages.retry});
    } finally {
      setPending(false);
    }
  };

  const errorFor = (field: string): string | undefined => fieldErrors[field]?.join(" ") || undefined;

  return (
    <form lang={locale} className="contact-form space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field">
          <Input className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" id="contact-name" name="name" placeholder=" " value={values.name} onChange={(event) => updateValue("name", event.currentTarget.value)} aria-invalid={Boolean(errorFor("name"))} aria-describedby={errorFor("name") ? "contact-name-error" : undefined} required />
          <Label className="contact-field__label" htmlFor="contact-name">{t("contact.name")}</Label>
        </div>
        <FormErrorMessage id="contact-name-error" message={errorFor("name")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field">
          <Input className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" id="contact-email" name="email" type="email" placeholder=" " value={values.email} onChange={(event) => updateValue("email", event.currentTarget.value)} aria-invalid={Boolean(errorFor("email"))} aria-describedby={errorFor("email") ? "contact-email-error" : undefined} />
          <Label className="contact-field__label" htmlFor="contact-email">{t("contact.email")}</Label>
        </div>
        <FormErrorMessage id="contact-email-error" message={errorFor("email")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field">
          <Input className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" id="contact-whatsapp" name="whatsapp" type="tel" placeholder=" " value={values.whatsapp} onChange={(event) => updateValue("whatsapp", event.currentTarget.value)} aria-invalid={Boolean(errorFor("whatsapp"))} aria-describedby={errorFor("whatsapp") ? "contact-whatsapp-error" : undefined} />
          <Label className="contact-field__label" htmlFor="contact-whatsapp">{t("contact.whatsapp")}</Label>
        </div>
        <FormErrorMessage id="contact-whatsapp-error" message={errorFor("whatsapp")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field" data-floating="true">
          <Select name="eventType" value={values.eventType} onValueChange={(eventType) => updateValue("eventType", eventType as Values["eventType"])}>
            <SelectTrigger id="contact-event-type" className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" aria-invalid={Boolean(errorFor("eventType"))} aria-describedby={errorFor("eventType") ? "contact-event-type-error" : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wedding">{t("category.wedding")}</SelectItem>
              <SelectItem value="events">{t("category.events")}</SelectItem>
              <SelectItem value="other">{t("category.other")}</SelectItem>
            </SelectContent>
          </Select>
          <Label className="contact-field__label" htmlFor="contact-event-type">{t("contact.eventType")}</Label>
        </div>
        <FormErrorMessage id="contact-event-type-error" message={errorFor("eventType")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field" data-floating={values.eventDate ? "true" : undefined}>
          <DatePicker id="contact-event-date" name="eventDate" value={values.eventDate} onChange={(eventDate) => updateValue("eventDate", eventDate)} locale={locale} clearLabel={t("contact.clearDate")} invalid={Boolean(errorFor("eventDate"))} describedBy={errorFor("eventDate") ? "contact-event-date-error" : undefined} />
          <Label className="contact-field__label" htmlFor="contact-event-date">{t("contact.eventDate")}</Label>
        </div>
        <FormErrorMessage id="contact-event-date-error" message={errorFor("eventDate")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field">
          <Input className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" id="contact-event-location" name="eventLocation" placeholder=" " value={values.eventLocation} onChange={(event) => updateValue("eventLocation", event.currentTarget.value)} aria-invalid={Boolean(errorFor("eventLocation"))} aria-describedby={errorFor("eventLocation") ? "contact-event-location-error" : undefined} />
          <Label className="contact-field__label" htmlFor="contact-event-location">{t("contact.eventLocation")}</Label>
        </div>
        <FormErrorMessage id="contact-event-location-error" message={errorFor("eventLocation")} />
      </div>
      <div data-contact-reveal="" className="contact-form__row grid gap-2">
        <div className="contact-field contact-field--textarea">
          <Textarea className="min-w-0 w-full border-[var(--line)] bg-transparent px-3 py-2" id="contact-message" name="message" placeholder=" " value={values.message} onChange={(event) => updateValue("message", event.currentTarget.value)} aria-invalid={Boolean(errorFor("message"))} aria-describedby={errorFor("message") ? "contact-message-error" : undefined} required />
          <Label className="contact-field__label" htmlFor="contact-message">{t("contact.message")}</Label>
        </div>
        <FormErrorMessage id="contact-message-error" message={errorFor("message")} />
      </div>
        <Button type="submit" className="contact-submit h-9 px-5" disabled={pending} aria-label={pending ? t("contact.submitting") : t("contact.submit")}>
          <span className="contact-submit__clip" aria-hidden="true">
            <span>{pending ? t("contact.submitting") : t("contact.submit")}</span>
            <span>{pending ? t("contact.submitting") : t("contact.submit")}</span>
          </span>
        </Button>
      {status ? <div className="flex flex-wrap items-center gap-3" role="alert" aria-live="polite">
        <span>{status.message}</span>
        {status.kind === "conflict" && status.actionLabel ? <Button type="button" variant="outline" className="h-9" onClick={resetForNewEnquiry}>{status.actionLabel}</Button> : null}
      </div> : null}
    </form>
  );
}
