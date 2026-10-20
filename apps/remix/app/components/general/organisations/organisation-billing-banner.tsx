import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { AlertTriangleIcon } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Shown while the organisation has an overdue bill, which holds it to the free
 * plan limits until Asaas confirms the payment.
 */
export const OrganisationBillingBanner = () => {
  const organisation = useOptionalCurrentOrganisation();

  if (!organisation || organisation.subscription?.status !== SubscriptionStatus.INACTIVE) {
    return null;
  }

  const canManageBilling = canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole);

  return (
    <div className="bg-destructive text-destructive-foreground">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 font-medium text-sm">
        <div className="flex items-center">
          <AlertTriangleIcon className="mr-2.5 h-5 w-5" />

          {canManageBilling ? (
            <Trans>Overdue bill: free plan limits apply until it is paid.</Trans>
          ) : (
            <Trans>Overdue bill: free plan limits apply. Ask an organisation admin to pay it.</Trans>
          )}
        </div>

        {canManageBilling && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-destructive-foreground hover:bg-destructive hover:text-white"
          >
            <Link to={`/o/${organisation.url}/settings/billing`}>
              <Trans>Pay bill</Trans>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
