"use client";

import type * as React from "react";

import {LoginForm} from "@/components/login-form";

export default function AdminLoginPage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <LoginForm />
    </main>
  );
}
