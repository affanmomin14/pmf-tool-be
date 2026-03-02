export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Array<{ field: string; message: string }>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class AIError extends AppError {
  constructor(message: string = 'AI service error') {
    super(message, 502, 'AI_ERROR');
  }
}

export class SpendLimitError extends AppError {
  constructor(message: string = 'Daily AI spend limit reached. Try again tomorrow.') {
    super(message, 429, 'SPEND_LIMIT_EXCEEDED');
  }
}
