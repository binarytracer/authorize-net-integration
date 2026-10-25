import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthnetClient } from '../src/authnet/client';
import { HealthController } from '../src/health/health.controller';
import { PaymentsController } from '../src/payments/payments.controller';

const charge = vi.fn();
let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    controllers: [PaymentsController, HealthController],
    providers: [{ provide: AuthnetClient, useValue: { charge } }],
  }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(() => app.close());

const valid = { amount: '10.00', opaqueData: { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'tok' } };

describe('API', () => {
  it('reports health', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.body).toEqual({ ok: true, environment: 'sandbox' });
  });

  it('returns 200 with the transaction id on approval', async () => {
    charge.mockResolvedValueOnce({ ok: true, transactionId: '123', authCode: 'ABC' });
    const res = await request(app.getHttpServer()).post('/payments').send(valid);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, transactionId: '123', authCode: 'ABC' });
  });

  it('returns 402 when the card is declined', async () => {
    charge.mockResolvedValueOnce({ ok: false, code: '2', message: 'declined' });
    const res = await request(app.getHttpServer()).post('/payments').send(valid);
    expect(res.status).toBe(402);
    expect(res.body.ok).toBe(false);
  });

  it('rejects a bad amount with 400 and does not call Authorize.net', async () => {
    charge.mockClear();
    const res = await request(app.getHttpServer()).post('/payments').send({ ...valid, amount: '10' });
    expect(res.status).toBe(400);
    expect(charge).not.toHaveBeenCalled();
  });

  it('rejects an empty token with 400 and reports the nested field path', async () => {
    charge.mockClear();
    const res = await request(app.getHttpServer())
      .post('/payments')
      .send({ ...valid, opaqueData: { dataDescriptor: '', dataValue: 'tok' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(res.body.details[0].path).toBe('opaqueData.dataDescriptor');
    expect(charge).not.toHaveBeenCalled();
  });
});
