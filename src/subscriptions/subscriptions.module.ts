import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
@Module({ controllers: [SubscriptionsController], providers: [SubscriptionsRepository, SubscriptionsService], exports: [SubscriptionsRepository, SubscriptionsService] })
export class SubscriptionsModule {}
