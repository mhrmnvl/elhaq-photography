"use client";

import * as React from "react";
import {cn} from "cn";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {authClient} from "@/lib/auth-client";

function GoogleMark(): React.ReactElement {
  return (
    <svg data-slot="google-mark" aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24c-.23 1.4-1.05 2.59-2.24 3.39v2.77h3.63c2.13-1.96 3.36-4.85 3.36-8.19Z" />
      <path fill="#34A853" d="M12 21.5c3.04 0 5.59-1.01 7.46-2.74l-3.63-2.77c-1.01.68-2.3 1.08-3.83 1.08-2.94 0-5.43-1.99-6.32-4.66H1.93v2.86A11.25 11.25 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M5.68 12.41a6.76 6.76 0 0 1-.36-2.16c0-.75.13-1.48.36-2.16V5.23H1.93A11.25 11.25 0 0 0 .75 10.25c0 1.81.43 3.52 1.18 5.02l3.75-2.86Z" />
      <path fill="#EA4335" d="M12 3.43c1.65 0 3.14.57 4.31 1.69l3.23-3.23C17.59.13 15.04-.88 12-.88A11.25 11.25 0 0 0 1.93 5.23l3.75 2.86C6.57 5.42 9.06 3.43 12 3.43Z" />
    </svg>
  );
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signIn = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({provider: "google", callbackURL: "/admin"});
      if (result.error) setError("Google sign-in could not be started. Try again.");
    } catch {
      setError("Google sign-in could not be started. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-[var(--line)] bg-[var(--ivory)] shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-3xl font-normal">Welcome back</CardTitle>
          <CardDescription>Sign in with Google to manage Elhaq Photography.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Field>
              <Button type="button" variant="outline" className="min-h-11 w-full border-[var(--line)] bg-[var(--ivory)] text-[var(--charcoal)] hover:bg-[var(--muted)] hover:text-[var(--charcoal)]" onClick={() => void signIn()} disabled={pending} aria-busy={pending} aria-label={pending ? "Connecting to Google" : "Continue with Google"}>
                <GoogleMark />
                <span>Google</span>
              </Button>
            </Field>
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-[var(--ivory)]">Or continue with</FieldSeparator>
            <form aria-describedby="future-login-description">
              <fieldset disabled>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="future-email">Email</FieldLabel>
                    <Input id="future-email" type="email" placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="future-password">Password</FieldLabel>
                    <Input id="future-password" type="password" autoComplete="current-password" />
                  </Field>
                  <Button type="submit" variant="outline" className="min-h-11 w-full">Email sign-in coming later</Button>
                </FieldGroup>
              </fieldset>
              <FieldDescription id="future-login-description" className="mt-4 text-center">Email and password sign-in will be added later.</FieldDescription>
            </form>
            {error ? <p role="alert" aria-live="polite" className="mt-4">{error}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
