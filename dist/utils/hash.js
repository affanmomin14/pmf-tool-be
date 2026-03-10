"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashIp = void 0;
const crypto_1 = require("crypto");
const SALT = 'pmf-insights-ip-salt:';
const hashIp = (ip) => (0, crypto_1.createHash)('sha256').update(`${SALT}${ip}`).digest('hex');
exports.hashIp = hashIp;
