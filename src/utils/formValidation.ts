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

export function isValidEmail(email: string): boolean {
  return email.includes("@");
}

export function validateLoginForm(input: {
  email: string;
  password: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(input.email)) {
    errors.email = "Enter a valid email address";
  }

  if (!input.password.trim()) {
    errors.password = "Password is required";
  }

  return errors;
}

export function validateRegistrationForm(input: {
  contactName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!input.contactName.trim()) errors.contactName = "Full name is required";

  if (!input.email.trim()) errors.email = "Email is required";
  else if (!isValidEmail(input.email))
    errors.email = "Enter a valid email address";

  if (!input.phone.trim()) errors.phone = "Phone number is required";

  if (!input.password) errors.password = "Password is required";
  else if (input.password.length < 6)
    errors.password = "Password must be at least 6 characters";

  if (!input.confirmPassword)
    errors.confirmPassword = "Please confirm your password";
  else if (input.password !== input.confirmPassword)
    errors.confirmPassword = "Passwords do not match";

  return errors;
}
