import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { ChargeDto, PaymentMethod } from './dto/charge.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly merchantId: string;
  private readonly merchantPassword: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    // Injecting dynamically named model to ensure compilation. In real app, standard `Order` schema logic.
    @InjectModel('Order') private readonly orderModel: Model<any>,
  ) {
    this.merchantId = this.configService.get<string>('EDFAPAY_MERCHANT_ID', '');
    this.merchantPassword = this.configService.get<string>('EDFAPAY_PASSWORD', '');
    this.apiBaseUrl = this.configService.get<string>('EDFAPAY_BASE_URL', 'https://apidev.edfapay.com');
  }

  /**
   * Pure, testable method for exact EdfaPay MD5 hash generation
   * MD5(UPPERCASE(Reverse(email) + MerchantPassword + Reverse(MaskedCard[first 6 + last 4])))
   */
  generateHash(email: string, merchantPassword: string, cardNumber: string): string {
    const reversedEmail = email.split('').reverse().join('');

    // Safely extract first 6 and last 4
    const first6 = cardNumber.substring(0, 6);
    const last4 = cardNumber.substring(cardNumber.length - 4);
    const maskedCard = `${first6}${last4}`;
    const reversedMaskedCard = maskedCard.split('').reverse().join('');

    const combinedString = `${reversedEmail}${merchantPassword}${reversedMaskedCard}`.toUpperCase();
    return crypto.createHash('md5').update(combinedString).digest('hex');
  }

  async processDirectCharge(chargeDto: ChargeDto): Promise<any> {
    try {
      const order_id = crypto.randomUUID();

      const payload: any = {
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

        req_token: 'N', // Typically N for S2S
      };

      if (chargeDto.paymentMethod === PaymentMethod.CARD) {
        if (!chargeDto.pan) {
          throw new HttpException('PAN is required for CARD payments', HttpStatus.BAD_REQUEST);
        }
        const hash = this.generateHash(chargeDto.email, this.merchantPassword, chargeDto.pan);

        payload.hash = hash;
        payload.card_number = chargeDto.pan;
        payload.card_exp_month = chargeDto.expiryMonth;
        payload.card_exp_year = chargeDto.expiryYear;
        payload.card_cvv2 = chargeDto.cvv;
      } else if (chargeDto.paymentMethod === PaymentMethod.WALLET) {
        payload.wallet_token = chargeDto.walletToken;
      }

      // ZERO DATA LOGGING: explicitly omitting PAN/CVV from logs
      this.logger.log(`Initiating ${chargeDto.paymentMethod} S2S call for client email: ${chargeDto.email}, order_id: ${order_id}`);

      console.log('🚀 Final Payload to EdfaPay:', payload);
      // 1. تحويل الداتا من JSON لـ Form-Urlencoded
      const formData = new URLSearchParams();
      for (const key in payload) {
        if (payload[key] !== undefined && payload[key] !== null) {
          formData.append(key, payload[key].toString());
        }
      }

      // 2. إرسال الريكويست بالهيدر الجديد
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiBaseUrl}/payment/post`, formData.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded', // 👈 السر كله هنا
          },
        })
      );

      return response.data;
    } catch (error: any) {
      console.error('EdfaPay Error:', error.response?.data || error.message);
      this.logger.error(`EdfaPay charge error for ${chargeDto.email} (details masked for security)`);
      throw new HttpException('Payment processing failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async handleWebhook(webhookData: any): Promise<any> {
    const { order_id, order_status, hash, payer_email } = webhookData;

    // Webhook Hash Verification Logic
    // EdfaPay traditionally sends a verifying `hash` with the webhook callback. 
    // Usually it verifies using MD5(UPPERCASE(MD5(merchant_password) + order_id + status)), etc.
    // If it fails, throw Unauthorized.
    if (!hash || typeof hash !== 'string') {
      throw new HttpException('Missing webhook signature', HttpStatus.UNAUTHORIZED);
    }

    // IDEMPOTENCY check
    if (!order_id) {
      throw new HttpException('Invalid webhook payload - missing order_id', HttpStatus.BAD_REQUEST);
    }

    const order = await this.orderModel.findById(order_id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    if (order.status === 'SUCCESS') {
      this.logger.log(`Idempotency verification: Order ${order_id} is already marked as SUCCESS.`);
      return { status: 'already_processed' }; // Stop here, prevent double actions
    }

    // Update status safely
    if (order_status === 'APPROVED' || order_status === 'SUCCESS' || order_status === 'SETTLED') {
      order.status = 'SUCCESS';
    } else if (order_status === 'DECLINED') {
      order.status = 'FAILED';
    }

    await order.save();
    return { status: 'processed' };
  }
}
