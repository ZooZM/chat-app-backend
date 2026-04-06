"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let GlobalResponseInterceptor = class GlobalResponseInterceptor {
    intercept(context, next) {
        return next.handle().pipe((0, operators_1.map)((data) => {
            const returnedMessage = typeof data === 'object' && data !== null && 'message' in data ? data.message : 'Request successful';
            const returnedData = typeof data === 'object' && data !== null && 'data' in data ? data.data : data;
            return {
                success: true,
                message: returnedMessage,
                data: returnedData,
            };
        }));
    }
};
exports.GlobalResponseInterceptor = GlobalResponseInterceptor;
exports.GlobalResponseInterceptor = GlobalResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], GlobalResponseInterceptor);
//# sourceMappingURL=global-response.interceptor.js.map