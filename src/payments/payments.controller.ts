import { Body, Controller, Post, Res, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthnetClient, type ChargeResult } from '../authnet/client';
import { CreatePaymentDto } from './create-payment.dto';
import { requestValidationPipe } from './validation.pipe';

@ApiTags('payments')
@UsePipes(requestValidationPipe)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly authnet: AuthnetClient) {}

  @Post()
  @ApiOperation({ summary: 'Charge an Accept.js / Accept mobile SDK token against the sandbox' })
  @ApiResponse({
    status: 200,
    description: 'Approved',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true }, transactionId: { type: 'string' }, authCode: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 402,
    description: 'Declined or failed',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: false }, code: { type: 'string' }, message: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async create(
    @Body() body: CreatePaymentDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChargeResult> {
    const { invoiceNumber, ...rest } = body;
    const result = await this.authnet.charge({ ...rest, ...(invoiceNumber ? { invoiceNumber } : {}) });
    res.status(result.ok ? 200 : 402);
    return result;
  }
}
