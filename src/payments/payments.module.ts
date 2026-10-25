import { Module } from '@nestjs/common';
import { AuthnetModule } from '../authnet/authnet.module';
import { PaymentsController } from './payments.controller';

@Module({ imports: [AuthnetModule], controllers: [PaymentsController] })
export class PaymentsModule {}
