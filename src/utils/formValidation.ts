export type FormErrors = Record<string, string>;

export function hasFormErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function clearFieldError(errors: FormErrors, field: string): FormErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
