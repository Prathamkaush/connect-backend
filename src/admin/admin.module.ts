import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
@Module({ imports: [UsersModule, MastersModule, SubscriptionsModule, PaymentsModule, SettingsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
