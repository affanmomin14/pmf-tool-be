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
exports.getMicroInsights = exports.getSocialProof = exports.getFacts = exports.getCategories = exports.getQuestions = void 0;
const systemService = __importStar(require("../services/system.service"));
const getQuestions = async (_req, res) => {
    const questions = await systemService.getActiveQuestions();
    res.json({ success: true, data: questions });
};
exports.getQuestions = getQuestions;
const getCategories = async (_req, res) => {
    const categories = await systemService.getActiveCategories();
    res.json({ success: true, data: categories });
};
exports.getCategories = getCategories;
const getFacts = async (req, res) => {
    const location = req.query.location;
    const facts = await systemService.getActiveFacts(location);
    res.json({ success: true, data: facts });
};
exports.getFacts = getFacts;
const getSocialProof = async (_req, res) => {
    const socialProof = await systemService.getActiveSocialProof();
    res.json({ success: true, data: socialProof });
};
exports.getSocialProof = getSocialProof;
const getMicroInsights = async (req, res) => {
    const questionId = Number(req.params.questionId);
    const insights = await systemService.getMicroInsightsByQuestion(questionId);
    res.json({ success: true, data: insights });
};
exports.getMicroInsights = getMicroInsights;
