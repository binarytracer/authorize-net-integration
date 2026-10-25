// Simulates the mobile app: card -> Authorize.net Accept (token) -> this API (/payments).
// Sandbox only. The card goes to Authorize.net, never to our server; we only send the token.
//
//   yarn client                                  # default sandbox test card, 10.00
//   yarn client --amount 25.50 --card 4007000000027 --exp 1230 --cvv 123 --name "Ada Lovelace"
//   yarn client --random                         # random card, name, amount, expiry, invoice
//   yarn client --random --count 5               # five random payments in a row
//   yarn client --random --card 370000000000002  # random, but pin the card (cvv follows the brand)
import { parseArgs } from 'node:util';
import axios from 'axios';

const ACCEPT_URL = 'https://apitest.authorize.net/xml/v1/request.api';

// Authorize.net sandbox test cards. `cvvLength` is 4 for Amex, 3 for the rest.
// `random: false` keeps a card out of --random runs because this sandbox account does not approve it
// (Diners: declined, code 17; Visa 4012888818888: held for review, code 252). They still work with --card,
// which is handy for exercising the 402 path.
const TEST_CARDS = [
  { brand: 'Visa', number: '4111111111111111', cvvLength: 3 },
  { brand: 'Visa', number: '4007000000027', cvvLength: 3 },
  { brand: 'Visa', number: '4012888818888', cvvLength: 3, random: false },
  { brand: 'Mastercard', number: '5424000000000015', cvvLength: 3 },
  { brand: 'Mastercard', number: '2223000010309703', cvvLength: 3 },
  { brand: 'Amex', number: '370000000000002', cvvLength: 4 },
  { brand: 'Discover', number: '6011000000000012', cvvLength: 3 },
  { brand: 'JCB', number: '3088000000000017', cvvLength: 3 },
  { brand: 'Diners', number: '38000000000006', cvvLength: 3, random: false },
];
const FIRST_NAMES = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim'];
const LAST_NAMES = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Berners-Lee'];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

const { values } = parseArgs({
  options: {
    amount: { type: 'string' },
    card: { type: 'string' },
    exp: { type: 'string' }, // MMYY
    cvv: { type: 'string' },
    name: { type: 'string' },
    invoice: { type: 'string' },
    random: { type: 'boolean', default: false },
    count: { type: 'string', default: '1' },
    api: { type: 'string', default: `http://localhost:${process.env.PORT ?? 3000}` },
  },
});

const loginId = process.env.AUTHNET_API_LOGIN_ID;
const clientKey = process.env.AUTHNET_CLIENT_KEY; // public client key, safe on a device
if (!loginId || !clientKey) {
  console.error('Set AUTHNET_API_LOGIN_ID and AUTHNET_CLIENT_KEY in .env (sandbox).');
  process.exit(1);
}

interface Payment {
  amount: string;
  card: string;
  exp: string;
  cvv: string;
  name: string;
  invoice?: string;
}

// Explicit flags win; with --random the gaps are filled randomly, otherwise with fixed defaults.
function buildPayment(): Payment {
  if (!values.random) {
    return {
      amount: values.amount ?? '10.00',
      card: values.card ?? '4111111111111111',
      exp: values.exp ?? '1230',
      cvv: values.cvv ?? '123',
      name: values.name ?? 'Test Customer',
      ...(values.invoice ? { invoice: values.invoice } : {}),
    };
  }
  const known = TEST_CARDS.find((c) => c.number === values.card);
  const card = values.card ? known : pick(TEST_CARDS.filter((c) => c.random !== false));
  const year = (new Date().getFullYear() + 1 + Math.floor(Math.random() * 4)) % 100;
  const month = 1 + Math.floor(Math.random() * 12);
  return {
    amount: values.amount ?? (1 + Math.random() * 499).toFixed(2),
    card: values.card ?? card?.number ?? '',
    exp: values.exp ?? `${String(month).padStart(2, '0')}${String(year).padStart(2, '0')}`,
    cvv: values.cvv ?? digits(card?.cvvLength ?? 3),
    name: values.name ?? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    invoice: values.invoice ?? `INV-${digits(8)}`,
  };
}

interface OpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

// Step 1: what Accept.js / the Accept mobile SDK does on the device.
async function tokenizeCard(p: Payment): Promise<OpaqueData> {
  const res = await axios.post<string>(
    ACCEPT_URL,
    {
      securePaymentContainerRequest: {
        merchantAuthentication: { name: loginId, clientKey },
        data: {
          type: 'TOKEN',
          id: crypto.randomUUID(),
          token: { cardNumber: p.card, expirationDate: p.exp, cardCode: p.cvv, fullName: p.name },
        },
      },
    },
    { responseType: 'text', transformResponse: (r) => r },
  );
  // Authorize.net prefixes its JSON with a BOM.
  const body = JSON.parse(res.data.replace(/^﻿/, ''));
  if (body.messages?.resultCode !== 'Ok') {
    throw new Error(`Accept rejected the card: ${JSON.stringify(body.messages?.message)}`);
  }
  return body.opaqueData;
}

async function pay(p: Payment): Promise<boolean> {
  const masked = `${'*'.repeat(Math.max(0, p.card.length - 4))}${p.card.slice(-4)}`;
  console.log(`1. Tokenizing card ${masked} (${p.name}, exp ${p.exp}) with Authorize.net Accept...`);
  const opaqueData = await tokenizeCard(p);
  console.log('   got one-time token');

  console.log(`2. POST ${values.api}/payments amount=${p.amount}${p.invoice ? ` invoice=${p.invoice}` : ''}`);
  const res = await axios.post(
    `${values.api}/payments`,
    { amount: p.amount, opaqueData, ...(p.invoice ? { invoiceNumber: p.invoice } : {}) },
    { validateStatus: () => true },
  );
  console.log(`   ${res.status}`, JSON.stringify(res.data, null, 2));
  return res.status === 200;
}

async function main() {
  const count = Math.max(1, Number.parseInt(values.count ?? '1', 10) || 1);
  let failed = 0;
  for (let i = 1; i <= count; i++) {
    if (count > 1) console.log(`\n--- payment ${i}/${count} ---`);
    if (!(await pay(buildPayment()))) failed++;
  }
  if (count > 1) console.log(`\n${count - failed}/${count} approved`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(axios.isAxiosError(e) ? `${e.message}: ${JSON.stringify(e.response?.data)}` : e);
  process.exit(1);
});
