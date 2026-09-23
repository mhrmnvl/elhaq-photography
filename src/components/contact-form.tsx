"use client";

import * as React from "react";
import {useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {DatePicker} from "@/components/ui/date-picker";
import {Field, FieldError, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
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

export type ContactFormValues = {name: string; email: string; whatsapp: string; eventType: "wedding" | "events" | "other"; eventDate: string; eventLocation: string; message: string};

const emptyValues: ContactFormValues = {name: "", email: "", whatsapp: "", eventType: "wedding", eventDate: "", eventLocation: "", message: ""};

export function validateContactValues(values: ContactFormValues, submissionKey: string): ReturnType<typeof parseContactInput> {
  return parseContactInput({...values, submissionKey});
}

export function ContactForm({locale}: {locale: Locale}): React.ReactElement {
  const t = useTranslations();
  const [values, setValues] = React.useState<ContactFormValues>(emptyValues);
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

  const resetForNewEnquiry = (): void => {
    setFieldErrors({});
    setStatus(null);
    submissionKey.current = crypto.randomUUID();
  };

  const submit = async (): Promise<void> => {
    if (pending) return;
    submissionKey.current ??= crypto.randomUUID();
    setStatus(null);
    setFieldErrors({});
    const validation = validateContactValues(values, submissionKey.current);
    if (!validation.ok) {
      const mapped = mapContactResponse(400, {ok: false, code: "VALIDATION_FAILED", fieldErrors: validation.fieldErrors}, messages);
      setFieldErrors(mapped.fieldErrors);
      setStatus(mapped.status);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(validation.value),
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
  const errorsFor = (field: string): {message: string}[] | undefined => {
    const message = errorFor(field);
    return message ? [{message}] : undefined;
  };

  return (
    <form lang={locale} className="space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
      <Field data-invalid={Boolean(errorFor("name"))}>
        <FieldLabel htmlFor="contact-name">{t("contact.name")}</FieldLabel>
        <Input id="contact-name" name="name" value={values.name} onChange={(event) => setValues({...values, name: event.currentTarget.value})} aria-invalid={Boolean(errorFor("name"))} aria-describedby={errorFor("name") ? "contact-name-error" : undefined} required />
        <FieldError id="contact-name-error" errors={errorsFor("name")} />
      </Field>
      <Field data-invalid={Boolean(errorFor("email"))}>
        <FieldLabel htmlFor="contact-email">{t("contact.email")}</FieldLabel>
        <Input id="contact-email" name="email" type="email" value={values.email} onChange={(event) => setValues({...values, email: event.currentTarget.value})} aria-invalid={Boolean(errorFor("email"))} aria-describedby={errorFor("email") ? "contact-email-error" : undefined} />
        <FieldError id="contact-email-error" errors={errorsFor("email")} />
      </Field>
      <Field data-invalid={Boolean(errorFor("whatsapp"))}>
        <FieldLabel htmlFor="contact-whatsapp">{t("contact.whatsapp")}</FieldLabel>
        <Input id="contact-whatsapp" name="whatsapp" type="tel" value={values.whatsapp} onChange={(event) => setValues({...values, whatsapp: event.currentTarget.value})} aria-invalid={Boolean(errorFor("whatsapp"))} aria-describedby={errorFor("whatsapp") ? "contact-whatsapp-error" : undefined} />
        <FieldError id="contact-whatsapp-error" errors={errorsFor("whatsapp")} />
      </Field>
      <Field>
        <FieldLabel htmlFor="contact-event-type">{t("contact.eventType")}</FieldLabel>
        <select className="min-h-11 min-w-0 w-full rounded-[var(--radius)] border border-[var(--line)] bg-transparent px-3 py-2" id="contact-event-type" name="eventType" value={values.eventType} onChange={(event) => setValues({...values, eventType: event.currentTarget.value as ContactFormValues["eventType"]})}>
          <option value="wedding">{t("category.wedding")}</option>
          <option value="events">{t("category.events")}</option>
          <option value="other">{t("category.other")}</option>
        </select>
      </Field>
      <Field data-invalid={Boolean(errorFor("eventDate"))}>
        <FieldLabel htmlFor="contact-event-date">{t("contact.eventDate")}</FieldLabel>
        <DatePicker id="contact-event-date" name="eventDate" value={values.eventDate} onChange={(eventDate) => setValues({...values, eventDate})} locale={locale} placeholder={t("contact.pickDate")} aria-invalid={Boolean(errorFor("eventDate"))} aria-describedby={errorFor("eventDate")}/>
        <FieldError id="contact-event-date-error" errors={errorsFor("eventDate")} />
      </Field>
      <Field data-invalid={Boolean(errorFor("eventLocation"))}>
        <FieldLabel htmlFor="contact-event-location">{t("contact.eventLocation")}</FieldLabel>
        <Input id="contact-event-location" name="eventLocation" value={values.eventLocation} onChange={(event) => setValues({...values, eventLocation: event.currentTarget.value})} aria-invalid={Boolean(errorFor("eventLocation"))} aria-describedby={errorFor("eventLocation") ? "contact-event-location-error" : undefined} />
        <FieldError id="contact-event-location-error" errors={errorsFor("eventLocation")} />
      </Field>
      <Field data-invalid={Boolean(errorFor("message"))}>
        <FieldLabel htmlFor="contact-message">{t("contact.message")}</FieldLabel>
        <Textarea id="contact-message" name="message" value={values.message} onChange={(event) => setValues({...values, message: event.currentTarget.value})} aria-invalid={Boolean(errorFor("message"))} aria-describedby={errorFor("message") ? "contact-message-error" : undefined} required />
        <FieldError id="contact-message-error" errors={errorsFor("message")} />
      </Field>
      <Button type="submit" className="min-h-11" disabled={pending}>{pending ? t("contact.submitting") : t("contact.submit")}</Button>
      {status ? <div className="flex flex-wrap items-center gap-3" role="alert" aria-live="polite">
        <span>{status.message}</span>
        {status.kind === "conflict" && status.actionLabel ? <Button type="button" variant="outline" className="min-h-11" onClick={resetForNewEnquiry}>{status.actionLabel}</Button> : null}
      </div> : null}
    </form>
  );
}
