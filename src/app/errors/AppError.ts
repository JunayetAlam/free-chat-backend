class AppError extends Error {
  public statusCode: number;
  public errorDetails?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    errorDetails?: Record<string, unknown>,
    stack = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
