import { describe, expect, it, vi } from 'vitest';
import { AuthnetClient, SANDBOX_URL } from '../src/authnet/client';

const creds = { apiLoginId: 'login', transactionKey: 'key' };
const input = { amount: '10.00', opaqueData: { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'tok' } };

function reply(json: unknown) {
  return vi.fn().mockResolvedValue(new Response('﻿' + JSON.stringify(json)));
}

describe('AuthnetClient.charge', () => {
  it('returns the transaction id on approval and posts to the sandbox', async () => {
    const f = reply({
      transactionResponse: { responseCode: '1', transId: '123', authCode: 'ABC' },
      messages: { resultCode: 'Ok', message: [{ code: 'I00001', text: 'Successful.' }] },
    });
    const res = await new AuthnetClient(creds, f).charge(input);
    expect(res).toEqual({ ok: true, transactionId: '123', authCode: 'ABC' });
    expect(f.mock.calls[0]![0]).toBe(SANDBOX_URL);
  });

  it('reports a declined card without throwing', async () => {
    const f = reply({
      transactionResponse: { responseCode: '2', errors: [{ errorCode: '2', errorText: 'This transaction has been declined.' }] },
      messages: { resultCode: 'Error', message: [{ code: 'E00027', text: 'declined' }] },
    });
    expect(await new AuthnetClient(creds, f).charge(input)).toEqual({
      ok: false, code: '2', message: 'This transaction has been declined.',
    });
  });

  it('does not report a held-for-review payment as a success', async () => {
    const f = reply({
      transactionResponse: {
        responseCode: '4',
        transId: '999',
        messages: [{ code: '252', description: 'Your order has been received. Thank you for your business!' }],
      },
      messages: { resultCode: 'Ok', message: [{ code: 'I00001', text: 'Successful.' }] },
    });
    expect(await new AuthnetClient(creds, f).charge(input)).toEqual({
      ok: false, code: '252', message: 'The payment is held for review and was not completed.',
    });
  });

  it('reports a duplicate transaction instead of the request-level "Successful."', async () => {
    const f = reply({
      transactionResponse: { responseCode: '3', messages: [{ code: '11', description: 'A duplicate transaction has been submitted.' }] },
      messages: { resultCode: 'Ok', message: [{ code: 'I00001', text: 'Successful.' }] },
    });
    expect(await new AuthnetClient(creds, f).charge(input)).toEqual({
      ok: false, code: '11', message: 'A duplicate transaction has been submitted.',
    });
  });

  it('handles a network failure', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await new AuthnetClient(creds, f).charge(input)).toMatchObject({ ok: false, code: 'NETWORK' });
  });

  it('handles an unreadable response', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>'));
    expect(await new AuthnetClient(creds, f).charge(input)).toMatchObject({ ok: false, code: 'BAD_RESPONSE' });
  });
});
