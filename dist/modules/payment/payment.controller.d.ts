import { PaymentService } from './payment.service';
import { ChargeDto } from './dto/charge.dto';
export declare class PaymentController {
    private readonly paymentService;
    constructor(paymentService: PaymentService);
    charge(chargeDto: ChargeDto): Promise<any>;
    webhook(webhookData: any): Promise<any>;
}
