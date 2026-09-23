export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isAllowedAdminIdentity(
  input: {email: string | null | undefined; emailVerified: boolean},
  configuredEmail: string,
): boolean {
  return input.emailVerified === true && input.email !== null && input.email !== undefined && normalizeEmail(input.email) === normalizeEmail(configuredEmail);
}
