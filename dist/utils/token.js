"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = void 0;
const nanoid_1 = require("nanoid");
const generateToken = () => (0, nanoid_1.nanoid)(21);
exports.generateToken = generateToken;
