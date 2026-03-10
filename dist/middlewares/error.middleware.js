"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../errors");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const errorHandler = (err, _req, res, _next) => {
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details;
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    }
    else if (err.name === 'ZodError' && 'issues' in err) {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = err.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
    }
    logger_1.logger.error({ err, statusCode }, 'Request error');
    const errorResponse = { code, message };
    if (details) {
        errorResponse.details = details;
    }
    if (env_1.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }
    res.status(statusCode).json({
        success: false,
        error: errorResponse,
    });
};
exports.errorHandler = errorHandler;
