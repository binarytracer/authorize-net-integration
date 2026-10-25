import { z } from 'zod';

// Sandbox only. There is deliberately no setting that points this at production.
export const SANDBOX_URL = 'https://apitest.authorize.net/xml/v1/request.api';

export interface AuthnetCredentials {
  apiLoginId: string;
  transactionKey: string;
}

export interface ChargeInput {
  amount: string;
  // One-time token produced on the device by Accept.js / the Accept mobile SDK.
  opaqueData: { dataDescriptor: string; dataValue: string };
  invoiceNumber?: string;
}

export type ChargeResult =
  | { ok: true; transactionId: string; authCode: string }
  | { ok: false; code: string; message: string };

const responseSchema = z.object({
  transactionResponse: z
    .object({
      responseCode: z.string().optional(),
      transId: z.string().optional(),
      authCode: z.string().optional(),
      errors: z.array(z.object({ errorCode: z.string(), errorText: z.string() })).optional(),
      messages: z.array(z.object({ code: z.string(), description: z.string() })).optional(),
    })
    .optional(),
  messages: z.object({
    resultCode: z.string(),
    message: z.array(z.object({ code: z.string(), text: z.string() })),
  }),
});

const RESPONSE_CODE_TEXT: Record<string, string> = {
  '2': 'The payment was declined.',
  '3': 'There was an error processing the payment.',
  '4': 'The payment is held for review and was not completed.',
};

type Fetch = typeof fetch;

export class AuthnetClient {
  constructor(
    private readonly creds: AuthnetCredentials,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const body = {
      createTransactionRequest: {
        merchantAuthentication: { name: this.creds.apiLoginId, transactionKey: this.creds.transactionKey },
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: input.amount,
          payment: { opaqueData: input.opaqueData },
          ...(input.invoiceNumber ? { order: { invoiceNumber: input.invoiceNumber } } : {}),
        },
      },
    };

    let res: Response;
    try {
      res = await this.fetchFn(SANDBOX_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, code: 'NETWORK', message: 'Could not reach Authorize.net.' };
    }

    // Authorize.net prefixes its JSON with a byte order mark.
    const text = (await res.text()).replace(/^﻿/, '');
    const parsed = responseSchema.safeParse(safeJson(text));
    if (!parsed.success) {
      return { ok: false, code: 'BAD_RESPONSE', message: 'Unexpected response from Authorize.net.' };
    }

    const { transactionResponse: tx, messages } = parsed.data;
    if (messages.resultCode === 'Ok' && tx?.responseCode === '1' && tx.transId) {
      return { ok: true, transactionId: tx.transId, authCode: tx.authCode ?? '' };
    }
    const err = tx?.errors?.[0];
    const txMsg = tx?.messages?.[0];
    // When the request itself succeeded, messages[0] only says "Successful." - that is not the payment result.
    const requestMsg = messages.resultCode === 'Ok' ? undefined : messages.message[0];
    return {
      ok: false,
      code: err?.errorCode ?? txMsg?.code ?? requestMsg?.code ?? (tx?.responseCode ? `RESPONSE_${tx.responseCode}` : 'DECLINED'),
      // Held for review comes back as "Your order has been received", which reads like a success.
      message:
        (tx?.responseCode === '4' ? RESPONSE_CODE_TEXT['4'] : undefined) ??
        err?.errorText ??
        txMsg?.description ??
        requestMsg?.text ??
        RESPONSE_CODE_TEXT[tx?.responseCode ?? ''] ??
        'The payment was declined.',
    };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
