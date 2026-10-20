import { handleAsaasWebhook } from '@documenso/lib/server-only/asaas/webhook/handle-asaas-webhook';

import type { Route } from './+types/asaas.webhook';

export async function action({ request }: Route.ActionArgs) {
  return await handleAsaasWebhook(request);
}
