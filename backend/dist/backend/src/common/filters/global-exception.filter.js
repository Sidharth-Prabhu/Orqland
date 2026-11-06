"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@orqland/contracts");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let errorCode = contracts_1.ChatErrorCode.INTERNAL_ERROR;
        let message = 'An unexpected error occurred';
        let details;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            }
            else if (typeof res === 'object' && res !== null) {
                const obj = res;
                message = obj.message || exception.message;
                if (obj.errorCode) {
                    errorCode = obj.errorCode;
                }
                else {
                    switch (status) {
                        case common_1.HttpStatus.UNAUTHORIZED:
                            errorCode = contracts_1.ChatErrorCode.UNAUTHORIZED;
                            break;
                        case common_1.HttpStatus.FORBIDDEN:
                            errorCode = contracts_1.ChatErrorCode.FORBIDDEN;
                            break;
                        case common_1.HttpStatus.NOT_FOUND:
                            errorCode = contracts_1.ChatErrorCode.CONVERSATION_NOT_FOUND;
                            break;
                        case common_1.HttpStatus.TOO_MANY_REQUESTS:
                            errorCode = contracts_1.ChatErrorCode.RATE_LIMIT_EXCEEDED;
                            break;
                        default:
                            errorCode = contracts_1.ChatErrorCode.INTERNAL_ERROR;
                    }
                }
                if (obj.details) {
                    details = obj.details;
                }
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            this.logger.error(`Unhandled Exception at ${request.url}:`, exception.stack);
        }
        const payload = {
            statusCode: status,
            error: common_1.HttpStatus[status] || 'Error',
            errorCode,
            message,
            details,
            timestamp: new Date().toISOString(),
        };
        response.status(status).json(payload);
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map