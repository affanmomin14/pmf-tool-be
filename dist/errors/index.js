"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpendLimitError = exports.AIError = exports.RateLimitError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}
exports.RateLimitError = RateLimitError;
class AIError extends AppError {
    constructor(message = 'AI service error') {
        super(message, 502, 'AI_ERROR');
    }
}
exports.AIError = AIError;
class SpendLimitError extends AppError {
    constructor(message = 'Daily AI spend limit reached. Try again tomorrow.') {
        super(message, 429, 'SPEND_LIMIT_EXCEEDED');
    }
}
exports.SpendLimitError = SpendLimitError;
