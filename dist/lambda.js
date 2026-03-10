"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const serverless_express_1 = require("@codegenie/serverless-express");
const app_1 = require("./app");
// Configure serverless express
const serverlessExpressInstance = (0, serverless_express_1.configure)({ app: app_1.app });
exports.handler = serverlessExpressInstance;
