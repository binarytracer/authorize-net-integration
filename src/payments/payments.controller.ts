import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthnetClient, type ChargeResult } from '../authnet/client';
import { type CreatePaymentDto, createPaymentSchema } from './create-payment.dto';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly authnet: AuthnetClient) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChargeResult> {
    const { invoiceNumber, ...rest } = body;
    const result = await this.authnet.charge({ ...rest, ...(invoiceNumber ? { invoiceNumber } : {}) });
    res.status(result.ok ? 200 : 402);
    return result;
  }
}
