import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DeviceTokensRepository } from './device-tokens.repository';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly deviceTokensRepository: DeviceTokensRepository) {}

  onModuleInit() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
      return;
    }
    if (admin.apps.length > 0) return;
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
    });
    this.logger.log('Firebase Admin initialised');
  }

  async sendPush(deviceToken: string, payload: { title: string; body: string; data?: Record<string, string> }): Promise<void> {
    if (admin.apps.length === 0) return;
    try {
      await admin.messaging().send({
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
    } catch (err) {
      this.logger.warn(`Failed to send push to ${deviceToken}: ${err.message}`);
    }
  }

  async notifyOfflineUser(userId: string, message: { content: string; senderName?: string; roomId: string }): Promise<void> {
    const tokens = await this.deviceTokensRepository.getTokens(userId);
    for (const doc of tokens) {
      await this.sendPush(doc.token, {
        title: message.senderName ?? 'New message',
        body: message.content || 'You have a new message',
        data: { roomId: message.roomId },
      });
    }
  }
}
