import { Module } from '@nestjs/common';
import { loadConfig } from '../config/app-config';
import { AuthnetClient } from './client';

@Module({
  providers: [
    {
      provide: AuthnetClient,
      useFactory: () => {
        const config = loadConfig();
        return new AuthnetClient({
          apiLoginId: config.AUTHNET_API_LOGIN_ID,
          transactionKey: config.AUTHNET_TRANSACTION_KEY,
        });
      },
    },
  ],
  exports: [AuthnetClient],
})
export class AuthnetModule {}
