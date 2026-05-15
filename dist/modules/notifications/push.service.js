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
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const device_tokens_repository_1 = require("./device-tokens.repository");
let PushService = PushService_1 = class PushService {
    deviceTokensRepository;
    logger = new common_1.Logger(PushService_1.name);
    constructor(deviceTokensRepository) {
        this.deviceTokensRepository = deviceTokensRepository;
    }
    onModuleInit() {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountJson) {
            this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
            return;
        }
        if (admin.apps.length > 0)
            return;
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
        });
        this.logger.log('Firebase Admin initialised');
    }
    async sendPush(deviceToken, payload) {
        if (admin.apps.length === 0)
            return;
        try {
            await admin.messaging().send({
                token: deviceToken,
                notification: { title: payload.title, body: payload.body },
                data: payload.data ?? {},
            });
        }
        catch (err) {
            this.logger.warn(`Failed to send push to ${deviceToken}: ${err.message}`);
        }
    }
    async notifyOfflineUser(userId, message) {
        const tokens = await this.deviceTokensRepository.getTokens(userId);
        for (const doc of tokens) {
            await this.sendPush(doc.token, {
                title: message.senderName ?? 'New message',
                body: message.content || 'You have a new message',
                data: { roomId: message.roomId },
            });
        }
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [device_tokens_repository_1.DeviceTokensRepository])
], PushService);
//# sourceMappingURL=push.service.js.map