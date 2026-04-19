"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeDto = exports.PaymentMethod = void 0;
const class_validator_1 = require("class-validator");
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["WALLET"] = "WALLET";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
class ChargeDto {
    email;
    amount;
    paymentMethod;
    pan;
    cvv;
    expiryMonth;
    expiryYear;
    cardholder;
    walletToken;
}
exports.ChargeDto = ChargeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], ChargeDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(PaymentMethod),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.CARD),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "pan", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.CARD),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(3, 4),
    __metadata("design:type", String)
], ChargeDto.prototype, "cvv", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.CARD),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(2, 2),
    __metadata("design:type", String)
], ChargeDto.prototype, "expiryMonth", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.CARD),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(2, 4),
    __metadata("design:type", String)
], ChargeDto.prototype, "expiryYear", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.CARD),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "cardholder", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.paymentMethod === PaymentMethod.WALLET),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChargeDto.prototype, "walletToken", void 0);
//# sourceMappingURL=charge.dto.js.map