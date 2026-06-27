import { createZapiAdapter } from './adapters/zapi-adapter';
import type { WhatsappAdapter } from './adapters/whatsapp-adapter';
import type { TWhatsappTransportConfig } from './whatsapp-transport-config';

/**
 * Factory (strategy by `config.type`) that builds the right provider adapter.
 * Mirrors `packages/email/transports/build-transport.ts`. Add a provider by
 * adding a `case` here and a schema/type in `whatsapp-transport-config.ts`.
 */
export const buildWhatsappTransport = (config: TWhatsappTransportConfig): WhatsappAdapter => {
  switch (config.type) {
    case 'ZAPI':
      return createZapiAdapter(config);
  }
};
