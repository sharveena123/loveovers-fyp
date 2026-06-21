import Constants from "expo-constants";

function getAdminEmails(): string[] {
  const raw =
    process.env.EXPO_PUBLIC_ADMIN_EMAILS ||
    (Constants.expoConfig?.extra?.adminEmails as string | undefined) ||
    "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
