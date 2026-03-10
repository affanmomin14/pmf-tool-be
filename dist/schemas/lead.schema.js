"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeadSchema = void 0;
const v4_1 = require("zod/v4");
exports.createLeadSchema = v4_1.z.object({
    assessmentId: v4_1.z.uuid(),
    email: v4_1.z.email(),
});
