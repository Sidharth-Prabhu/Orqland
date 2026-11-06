"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentUser = (0, common_1.createParamDecorator)((data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    if (req?.user) {
        return req.user;
    }
    const wsClient = ctx.switchToWs().getClient();
    if (wsClient?.data?.user) {
        return wsClient.data.user;
    }
    throw new Error('CurrentUser decorator called without authenticated user context');
});
//# sourceMappingURL=current-user.decorator.js.map