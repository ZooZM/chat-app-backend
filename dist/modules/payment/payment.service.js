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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto = __importStar(require("crypto"));
const charge_dto_1 = require("./dto/charge.dto");
const rxjs_1 = require("rxjs");
let PaymentService = PaymentService_1 = class PaymentService {
    httpService;
    configService;
    orderModel;
    logger = new common_1.Logger(PaymentService_1.name);
    merchantId;
    merchantPassword;
    apiBaseUrl;
    constructor(httpService, configService, orderModel) {
        this.httpService = httpService;
        this.configService = configService;
        this.orderModel = orderModel;
        this.merchantId = this.configService.get('EDFAPAY_MERCHANT_ID', '');
        this.merchantPassword = this.configService.get('EDFAPAY_PASSWORD', '');
        this.apiBaseUrl = this.configService.get('EDFAPAY_BASE_URL', 'https://apidev.edfapay.com');
    }
    generateHash(email, merchantPassword, cardNumber) {
        const reversedEmail = email.split('').reverse().join('');
        const first6 = cardNumber.substring(0, 6);
        const last4 = cardNumber.substring(cardNumber.length - 4);
        const maskedCard = `${first6}${last4}`;
        const reversedMaskedCard = maskedCard.split('').reverse().join('');
        const combinedString = `${reversedEmail}${merchantPassword}${reversedMaskedCard}`.toUpperCase();
        return crypto.createHash('md5').update(combinedString).digest('hex');
    }
    async processDirectCharge(chargeDto) {
        try {
            const order_id = crypto.randomUUID();
            const payload = {
                action: 'SALE',
                client_key: this.merchantId,
                order_id: order_id,
                order_amount: chargeDto.amount,
                order_currency: 'SAR',
                order_description: 'Chat App Service Payment',
                payer_email: chargeDto.email,
                payer_ip: '127.0.0.1',
                payer_first_name: 'Zeyad',
                payer_last_name: 'Zeyad',
                payer_phone: '0500000000',
                req_token: 'N',
            };
            if (chargeDto.paymentMethod === charge_dto_1.PaymentMethod.CARD) {
                if (!chargeDto.pan) {
                    throw new common_1.HttpException('PAN is required for CARD payments', common_1.HttpStatus.BAD_REQUEST);
                }
                const hash = this.generateHash(chargeDto.email, this.merchantPassword, chargeDto.pan);
                payload.hash = hash;
                payload.card_number = chargeDto.pan;
                payload.card_exp_month = chargeDto.expiryMonth;
                payload.card_exp_year = chargeDto.expiryYear;
                payload.card_cvv2 = chargeDto.cvv;
            }
            else if (chargeDto.paymentMethod === charge_dto_1.PaymentMethod.WALLET) {
                payload.wallet_token = chargeDto.walletToken;
            }
            this.logger.log(`Initiating ${chargeDto.paymentMethod} S2S call for client email: ${chargeDto.email}, order_id: ${order_id}`);
            console.log('🚀 Final Payload to EdfaPay:', payload);
            const formData = new URLSearchParams();
            for (const key in payload) {
                if (payload[key] !== undefined && payload[key] !== null) {
                    formData.append(key, payload[key].toString());
                }
            }
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.apiBaseUrl}/payment/post`, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
            return response.data;
        }
        catch (error) {
            console.error('EdfaPay Error:', error.response?.data || error.message);
            this.logger.error(`EdfaPay charge error for ${chargeDto.email} (details masked for security)`);
            throw new common_1.HttpException('Payment processing failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async handleWebhook(webhookData) {
        const { order_id, order_status, hash, payer_email } = webhookData;
        if (!hash || typeof hash !== 'string') {
            throw new common_1.HttpException('Missing webhook signature', common_1.HttpStatus.UNAUTHORIZED);
        }
        if (!order_id) {
            throw new common_1.HttpException('Invalid webhook payload - missing order_id', common_1.HttpStatus.BAD_REQUEST);
        }
        const order = await this.orderModel.findById(order_id);
        if (!order) {
            throw new common_1.HttpException('Order not found', common_1.HttpStatus.NOT_FOUND);
        }
        if (order.status === 'SUCCESS') {
            this.logger.log(`Idempotency verification: Order ${order_id} is already marked as SUCCESS.`);
            return { status: 'already_processed' };
        }
        if (order_status === 'APPROVED' || order_status === 'SUCCESS' || order_status === 'SETTLED') {
            order.status = 'SUCCESS';
        }
        else if (order_status === 'DECLINED') {
            order.status = 'FAILED';
        }
        await order.save();
        return { status: 'processed' };
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectModel)('Order')),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        mongoose_2.Model])
], PaymentService);
//# sourceMappingURL=payment.service.js.map