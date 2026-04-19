import { Controller, Post, Body, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ChargeDto } from './dto/charge.dto';
import { GlobalResponseInterceptor } from '../../common/interceptors/global-response.interceptor';

@Controller('payment')
@UseInterceptors(GlobalResponseInterceptor)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('charge')
  @HttpCode(HttpStatus.OK)
  async charge(@Body() chargeDto: ChargeDto) {
    // Zero logging of the raw body here to strictly prevent unintentional CVV/PAN leaks
    const result = await this.paymentService.processDirectCharge(chargeDto);
    return result; // Global interceptor wraps this as { success: true, data: result } automatically
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() webhookData: any) {
    const result = await this.paymentService.handleWebhook(webhookData);
    return result;
  }
}
