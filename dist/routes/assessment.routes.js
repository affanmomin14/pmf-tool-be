"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const v4_1 = require("zod/v4");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const ctrl = __importStar(require("../controllers/assessment.controller"));
const router = (0, express_1.Router)();
const createAssessmentSchema = v4_1.z.object({
    problemType: v4_1.z.enum(['market_fit', 'product_quality', 'distribution', 'monetization', 'retention']),
    utmSource: v4_1.z.string().max(200).optional(),
    utmMedium: v4_1.z.string().max(200).optional(),
    utmCampaign: v4_1.z.string().max(200).optional(),
});
const assessmentParamsSchema = v4_1.z.object({
    id: v4_1.z.uuid(),
});
const createResponseSchema = v4_1.z.object({
    questionId: v4_1.z.number().int().min(1).max(5),
    answerText: v4_1.z.string().max(2000).optional(),
    answerValue: v4_1.z.string().max(200).optional(),
    timeSpentMs: v4_1.z.number().int().min(0).optional(),
    questionOrder: v4_1.z.number().int().min(1).max(5),
});
router.post('/', (0, validate_middleware_1.validate)({ body: createAssessmentSchema }), ctrl.createAssessment);
router.get('/:id', (0, validate_middleware_1.validate)({ params: assessmentParamsSchema }), ctrl.getAssessment);
router.post('/:id/responses', (0, validate_middleware_1.validate)({
    params: assessmentParamsSchema,
    body: createResponseSchema,
}), ctrl.createResponse);
router.post('/:id/complete', (0, validate_middleware_1.validate)({ params: assessmentParamsSchema }), ctrl.completeAssessment);
router.post('/:id/research', (0, validate_middleware_1.validate)({ params: assessmentParamsSchema }), ctrl.runResearch);
router.post('/:id/score', (0, validate_middleware_1.validate)({ params: assessmentParamsSchema }), ctrl.scoreAssessment);
exports.default = router;
