"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const errors_1 = require("../errors");
const validate = (schemas) => {
    return (req, _res, next) => {
        const errors = [];
        for (const [target, schema] of Object.entries(schemas)) {
            const result = schema.safeParse(req[target]);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    errors.push({
                        field: `${target}.${issue.path.join('.')}`,
                        message: issue.message,
                    });
                }
            }
            else {
                req[target] = result.data;
            }
        }
        if (errors.length > 0) {
            throw new errors_1.ValidationError('Validation failed', errors);
        }
        next();
    };
};
exports.validate = validate;
