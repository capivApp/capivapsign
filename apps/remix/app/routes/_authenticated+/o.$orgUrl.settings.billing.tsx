import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { formatBrl } from '@documenso/lib/universal/billing-format';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { LoaderIcon } from 'lucide-react';

import { OrganisationBillingProfileForm } from '~/components/forms/organisation-billing-profile-form';
import { BillingPlans } from '~/components/general/billing-plans';
import { OrganisationBillingInvoicesTable } from '~/components/tables/organisation-billing-invoices-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Billing`);
}

export default function OrganisationSettingsBillingPage() {
  const { i18n } = useLingui();

  const organisation = useCurrentOrganisation();

  const { data: billing, isLoading } = trpc.enterprise.billing.get.useQuery({
    organisationId: organisation.id,
  });

  if (isLoading || !billing) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canManageBilling = canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole);

  const currentPlan = billing.plans.find((plan) => plan.id === billing.currentPlanId);
  const scheduledPlan = billing.plans.find((plan) => plan.id === billing.subscription?.scheduledClaimId);
  const scheduledAt = billing.subscription?.scheduledAt;
  const isOverdue = billing.subscription?.status === SubscriptionStatus.INACTIVE;
  const discountPercent = billing.subscription?.discountPercent ?? 0;

  const currentPlanName = currentPlan?.name ?? '';
  const currentPlanPrice = formatBrl(currentPlan?.monthlyPriceCents ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold text-2xl">
          <Trans>Billing</Trans>
        </h3>

        <div className="mt-2 space-y-1 text-muted-foreground text-sm">
          {currentPlan && (
            <p>
              {currentPlan.monthlyPriceCents > 0 ? (
                <Trans>
                  Current plan: <span className="font-semibold">{currentPlanName}</span>, {currentPlanPrice} per month
                  plus usage, billed on the 1st.
                </Trans>
              ) : (
                <Trans>
                  Current plan: <span className="font-semibold">{currentPlanName}</span>. Usage is billed on the 1st.
                </Trans>
              )}
            </p>
          )}

          {discountPercent > 0 && (
            <p>
              {discountPercent === 100 ? (
                <Trans>Your plan has a 100% discount: bills show the amounts but are not charged.</Trans>
              ) : (
                <Trans>Your plan has a {discountPercent}% discount on every bill.</Trans>
              )}
            </p>
          )}

          {scheduledPlan && scheduledAt && (
            <p>
              <Trans>
                Your plan changes to <span className="font-semibold">{scheduledPlan.name}</span> on{' '}
                {i18n.date(scheduledAt, { timeZone: 'UTC' })}.
              </Trans>
            </p>
          )}
        </div>
      </div>

      {isOverdue && (
        <Alert variant="destructive">
          <AlertDescription>
            <Trans>You have an overdue bill. Free plan limits apply until it is paid.</Trans>
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h4 className="font-medium text-lg">
          <Trans>Billing details</Trans>
        </h4>

        <OrganisationBillingProfileForm
          organisationId={organisation.id}
          defaultValues={billing.billingProfile}
          canManageBilling={canManageBilling}
        />
      </section>

      <section className="space-y-4">
        <h4 className="font-medium text-lg">
          <Trans>Plans</Trans>
        </h4>

        <BillingPlans
          organisationId={organisation.id}
          plans={billing.plans}
          currentPlanId={billing.currentPlanId}
          scheduledClaimId={billing.subscription?.scheduledClaimId ?? null}
          scheduledAt={billing.subscription?.scheduledAt ?? null}
          hasBillingProfile={billing.hasBillingProfile}
          canManageBilling={canManageBilling}
        />
      </section>

      <section className="space-y-4">
        <h4 className="font-medium text-lg">
          <Trans>Bills</Trans>
        </h4>

        <OrganisationBillingInvoicesTable organisationId={organisation.id} />
      </section>
    </div>
  );
}
