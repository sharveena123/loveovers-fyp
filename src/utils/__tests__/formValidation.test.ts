import {
  clearFieldError,
  hasFormErrors,
  isValidEmail,
  validateLoginForm,
  validateRegistrationForm,
} from "@/src/utils/formValidation";

describe("Form validation", () => {
  describe("hasFormErrors", () => {
    it("returns false for an empty error map", () => {
      expect(hasFormErrors({})).toBe(false);
    });

    it("returns true when at least one field has an error", () => {
      expect(hasFormErrors({ email: "Email is required" })).toBe(true);
    });
  });

  describe("clearFieldError", () => {
    it("removes only the given field's error", () => {
      const errors = { email: "bad", password: "bad" };
      expect(clearFieldError(errors, "email")).toEqual({ password: "bad" });
    });

    it("returns the same object when the field has no error", () => {
      const errors = { password: "bad" };
      expect(clearFieldError(errors, "email")).toBe(errors);
    });
  });

  describe("validateLoginForm", () => {
    it("passes with a valid email and password", () => {
      const errors = validateLoginForm({
        email: "buyer@example.com",
        password: "secret123",
      });
      expect(errors).toEqual({});
    });

    it("requires an email", () => {
      const errors = validateLoginForm({ email: "   ", password: "secret123" });
      expect(errors.email).toBe("Email is required");
    });

    it("rejects an email without @", () => {
      const errors = validateLoginForm({
        email: "not-an-email",
        password: "secret123",
      });
      expect(errors.email).toBe("Enter a valid email address");
    });

    it("requires a password", () => {
      const errors = validateLoginForm({ email: "buyer@example.com", password: " " });
      expect(errors.password).toBe("Password is required");
    });
  });

  describe("validateRegistrationForm", () => {
    const validInput = {
      contactName: "Sharveena",
      email: "buyer@example.com",
      phone: "0123456789",
      password: "secret123",
      confirmPassword: "secret123",
    };

    it("passes with all fields valid", () => {
      expect(validateRegistrationForm(validInput)).toEqual({});
    });

    it("requires the full name", () => {
      const errors = validateRegistrationForm({ ...validInput, contactName: "  " });
      expect(errors.contactName).toBe("Full name is required");
    });

    it("requires a valid email", () => {
      expect(
        validateRegistrationForm({ ...validInput, email: "" }).email,
      ).toBe("Email is required");
      expect(
        validateRegistrationForm({ ...validInput, email: "invalid" }).email,
      ).toBe("Enter a valid email address");
    });

    it("requires a phone number", () => {
      const errors = validateRegistrationForm({ ...validInput, phone: "" });
      expect(errors.phone).toBe("Phone number is required");
    });

    it("enforces a minimum password length of 6", () => {
      const errors = validateRegistrationForm({
        ...validInput,
        password: "12345",
        confirmPassword: "12345",
      });
      expect(errors.password).toBe("Password must be at least 6 characters");
    });

    it("requires the confirmation password to match", () => {
      expect(
        validateRegistrationForm({ ...validInput, confirmPassword: "" })
          .confirmPassword,
      ).toBe("Please confirm your password");
      expect(
        validateRegistrationForm({ ...validInput, confirmPassword: "different" })
          .confirmPassword,
      ).toBe("Passwords do not match");
    });

    it("collects every invalid field in one pass", () => {
      const errors = validateRegistrationForm({
        contactName: "",
        email: "invalid",
        phone: "",
        password: "123",
        confirmPassword: "456",
      });
      expect(Object.keys(errors).sort()).toEqual([
        "confirmPassword",
        "contactName",
        "email",
        "password",
        "phone",
      ]);
    });
  });

  describe("isValidEmail", () => {
    it("accepts emails containing @", () => {
      expect(isValidEmail("a@b.com")).toBe(true);
    });

    it("rejects emails missing @", () => {
      expect(isValidEmail("ab.com")).toBe(false);
    });
  });
});
