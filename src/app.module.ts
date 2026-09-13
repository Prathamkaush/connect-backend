import { VoiceModule } from './voice/voice.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import aiConfig from './config/ai.config';
import paymentConfig from './config/payment.config';
import redisConfig from './config/redis.config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { MastersModule } from './masters/masters.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsageModule } from './usage/usage.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { validateEnvironment } from './config/environment.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment, load: [appConfig, databaseConfig, redisConfig, aiConfig, paymentConfig] }),
    VoiceModule, PrismaModule, RedisModule, StorageModule, SettingsModule, AuthModule, UsersModule, MastersModule, ConversationsModule, ChatModule, SubscriptionsModule, UsageModule, PaymentsModule, InvoicesModule, AdminModule, HealthModule,
  ],
})
export class AppModule {}
