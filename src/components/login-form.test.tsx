import {expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";

import {LoginForm} from "@/components/login-form";

test("labels the Google sign-in action with Google only", () => {
  const markup = renderToStaticMarkup(<LoginForm />);

  expect(markup).toContain("Welcome back");
  expect(markup).toContain("Or continue with");
  expect(markup).toContain('data-slot="google-mark"');
  expect(markup).toContain("><span>Google</span></button>");
  expect(markup).not.toContain(">Continue with Google<");
  expect(markup).not.toContain("Login with Apple");
});
