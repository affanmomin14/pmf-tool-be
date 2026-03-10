"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = void 0;
const sanitizeInput = (input) => {
    if (!input)
        return '';
    return input
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 500);
};
exports.sanitizeInput = sanitizeInput;
