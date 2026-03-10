"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const requestLogger_middleware_1 = require("./middlewares/requestLogger.middleware");
const error_middleware_1 = require("./middlewares/error.middleware");
const system_routes_1 = __importDefault(require("./routes/system.routes"));
const assessment_routes_1 = __importDefault(require("./routes/assessment.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const lead_routes_1 = __importDefault(require("./routes/lead.routes"));
exports.app = (0, express_1.default)();
// Security
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: env_1.env.CORS_ORIGINS.split(',').map((s) => s.trim()),
}));
// Body parsing
exports.app.use(express_1.default.json({ limit: '1mb' }));
// Request logging (BEFORE routes so every request is logged)
exports.app.use(requestLogger_middleware_1.requestLogger);
// Health check (no auth, no validation)
exports.app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
});
// Routes
exports.app.use('/api/system', system_routes_1.default);
exports.app.use('/api/assessments', assessment_routes_1.default);
exports.app.use('/api/reports', report_routes_1.default);
exports.app.use('/api/leads', lead_routes_1.default);
// Error handler (MUST be LAST middleware - after all routes)
exports.app.use(error_middleware_1.errorHandler);
