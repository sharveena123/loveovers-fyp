export type AiErrorContext =
  | "load"
  | "predict"
  | "batch_predict"
  | "save_sales"
  | "retrain"
  | "assess"
  | "train";

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

export function isAiNotFoundError(error: unknown): boolean {
  const lower = errorText(error).toLowerCase();
  return (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("cafe not found")
  );
}

function isNetworkError(lower: string): boolean {
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("failed to connect") ||
    lower.includes("network error")
  );
}

function isServerError(lower: string): boolean {
  return (
    /\b5\d{2}\b/.test(lower) ||
    lower.includes("internal server error") ||
    lower.includes("service unavailable")
  );
}

function isValidationError(lower: string): boolean {
  return (
    lower.includes("400") ||
    lower.includes("422") ||
    lower.includes("invalid") ||
    lower.includes("missing required") ||
    lower.includes("bad request")
  );
}

const CONTEXT_DEFAULTS: Record<
  AiErrorContext,
  { title: string; message: string }
> = {
  load: {
    title: "Could not load bake planner",
    message:
      "We could not load your shop data right now. Pull down to refresh or try again in a moment.",
  },
  predict: {
    title: "Could not get suggestion",
    message:
      "We could not calculate a bake amount for this item. Try again, or log a few more days of sales first.",
  },
  batch_predict: {
    title: "Could not get menu plan",
    message:
      "We could not build a full-day bake plan. Try again, or check that your sales file is uploaded.",
  },
  save_sales: {
    title: "Could not save",
    message:
      "Your daily sales were not saved. Check your connection and try again.",
  },
  retrain: {
    title: "Could not retrain",
    message:
      "The model was not updated. Make sure you have enough sales history, then try again.",
  },
  assess: {
    title: "Could not read your file",
    message:
      "We could not check your sales file. Make sure it is a valid CSV and try again.",
  },
  train: {
    title: "Could not save your file",
    message:
      "Training did not finish. Review your column labels and try again.",
  },
};

/** Turn raw API / network errors into seller-friendly copy (no status codes). */
export function getAiErrorMessage(
  error: unknown,
  context: AiErrorContext = "predict",
): { title: string; message: string } {
  const raw = errorText(error);
  const lower = raw.toLowerCase();
  const defaults = CONTEXT_DEFAULTS[context];

  if (isAiNotFoundError(error)) {
    return {
      title: "Sales file needed",
      message:
        "We could not find your shop's sales history. Upload your sales CSV again from the dashboard.",
    };
  }

  if (isNetworkError(lower)) {
    return {
      title: "Connection problem",
      message:
        "We could not reach the bake planner. Check your Wi‑Fi and that the AI service is running on your network, then try again.",
    };
  }

  if (isServerError(lower)) {
    return {
      title: "Bake planner busy",
      message:
        "Something went wrong on our side. Wait a moment and try again.",
    };
  }

  if (isValidationError(lower)) {
    if (context === "assess" || context === "train") {
      return {
        title: "File needs a fix",
        message:
          "Your sales file may be missing required columns or dates. Review the column labels and try again.",
      };
    }
    return {
      title: defaults.title,
      message:
        "Some information looks incomplete. Check your selections and try again.",
    };
  }

  return defaults;
}
