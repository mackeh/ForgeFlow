export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

export function toAppError(
  error: unknown,
  fallbackStatus = 400,
  fallbackCode = "BAD_REQUEST"
): AppError {
  if (error instanceof AppError) return error;
  return new AppError(fallbackStatus, fallbackCode, toErrorMessage(error));
}
