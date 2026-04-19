import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { ChargeDto } from './dto/charge.dto';
export declare class PaymentService {
    private readonly httpService;
    private readonly configService;
    private readonly orderModel;
    private readonly logger;
    private readonly merchantId;
    private readonly merchantPassword;
    private readonly apiBaseUrl;
    constructor(httpService: HttpService, configService: ConfigService, orderModel: Model<any>);
    generateHash(email: string, merchantPassword: string, cardNumber: string): string;
    processDirectCharge(chargeDto: ChargeDto): Promise<any>;
    handleWebhook(webhookData: any): Promise<any>;
}
