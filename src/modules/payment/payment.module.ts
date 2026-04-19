import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

// A minimal inline definition for the Order model to fulfill standard DI.
// In a production app, this would be imported from a centralized Database/Orders module.
const OrderSchema = new Schema({
  status: { type: String, default: 'PENDING' },
}, { strict: false, timestamps: true }); // strict: false allows Mongoose to save any other properties transparently

@Module({
  imports: [
    HttpModule,
    // Provide 'Order' to satisfy the Mongoose @InjectModel() in PaymentService
    MongooseModule.forFeature([{ name: 'Order', schema: OrderSchema }]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
