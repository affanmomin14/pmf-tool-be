"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
require("dotenv/config");
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
exports.server = app_1.app.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`Server running on port ${env_1.env.PORT}`);
});
async function gracefulShutdown(signal) {
    logger_1.logger.info(`${signal} received — shutting down gracefully`);
    exports.server.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
