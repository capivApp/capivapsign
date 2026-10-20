import { AppError } from '@documenso/lib/errors/app-error';
import type { BillingPlan } from '@documenso/lib/server-only/billing/get-billing-plans';
import { SUBSCRIPTION_CLAIM_PRICING_ITEMS } from '@documenso/lib/types/subscription';
import { formatBrl } from '@documenso/lib/universal/billing-format';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react';
import { Trans, useLingui as useLinguiMacro } from '@lingui/react/macro';
import { useState } from 'react';

export type BillingPlansProps = {
  organisationId: string;
  plans: BillingPlan[];
  currentPlanId: string | null;
  scheduledClaimId: string | null;
  scheduledAt: Date | null;
  hasBillingProfile: boolean;
  canManageBilling: boolean;
};

export const BillingPlans = (props: BillingPlansProps) => {
  const currentPlan = props.plans.find((plan) => plan.id === props.currentPlanId);

  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      {props.plans.map((plan) => (
        <Card key={plan.id}>
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div>
              <CardTitle>{plan.name}</CardTitle>
              <PlanPrice monthlyPriceCents={plan.monthlyPriceCents} />
            </div>

            <PlanDetails plan={plan} />

            <div className="flex-1" />

            <PlanAction {...props} plan={plan} currentPriceCents={currentPlan?.monthlyPriceCents ?? 0} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const PlanPrice = ({ monthlyPriceCents }: { monthlyPriceCents: number }) => (
  <div className="mt-2 font-medium text-lg text-muted-foreground">
    {monthlyPriceCents > 0 ? (
      <>
        {formatBrl(monthlyPriceCents)}{' '}
        <span className="text-xs">
          <Trans>per month</Trans>
        </span>
      </>
    ) : (
      <Trans context="Plan price">Free</Trans>
    )}
  </div>
);

const PlanDetails = ({ plan }: { plan: BillingPlan }) => {
  const memberCount = plan.memberCount;

  const usagePrices = SUBSCRIPTION_CLAIM_PRICING_ITEMS.filter((item) => (plan.pricing[item.unitKey] ?? 0) > 0);

  return (
    <ul className="divide-y text-muted-foreground text-sm">
      <li className="py-2">
        {memberCount === 0 ? <Trans>Unlimited members</Trans> : <Trans>Up to {memberCount} members</Trans>}
      </li>

      {usagePrices.map((item) => {
        const price = formatBrl(plan.pricing[item.unitKey] ?? 0);
        const freeQuota = plan.pricing[item.quotaKey] ?? 0;

        return (
          <li key={item.unitKey} className="py-2">
            {item.label}: {price}
            {freeQuota > 0 && (
              <>
                {' '}
                <Trans>({freeQuota} free per month)</Trans>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
};

type PlanActionProps = BillingPlansProps & {
  plan: BillingPlan;
  currentPriceCents: number;
};

const PlanAction = ({
  organisationId,
  plan,
  currentPlanId,
  currentPriceCents,
  scheduledClaimId,
  scheduledAt,
  hasBillingProfile,
  canManageBilling,
}: PlanActionProps) => {
  const { i18n } = useLingui();

  if (!canManageBilling) {
    return null;
  }

  const isCurrent = plan.id === currentPlanId;

  if (isCurrent && !scheduledClaimId) {
    return (
      <Button disabled variant="secondary">
        <Trans>Current plan</Trans>
      </Button>
    );
  }

  if (plan.id === scheduledClaimId && scheduledAt) {
    const date = i18n.date(scheduledAt, { timeZone: 'UTC' });

    return (
      <Button disabled variant="secondary">
        <Trans>Starts on {date}</Trans>
      </Button>
    );
  }

  if (plan.monthlyPriceCents > 0 && !hasBillingProfile) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full">
          <Trans>Choose plan</Trans>
        </Button>
        <p className="text-muted-foreground text-xs">
          <Trans>Fill in the billing details above to choose a paid plan.</Trans>
        </p>
      </div>
    );
  }

  return (
    <ChangePlanDialog
      organisationId={organisationId}
      plan={plan}
      isCurrent={isCurrent}
      isDowngrade={plan.monthlyPriceCents < currentPriceCents}
    />
  );
};

type ChangePlanDialogProps = {
  organisationId: string;
  plan: BillingPlan;
  isCurrent: boolean;
  isDowngrade: boolean;
};

const ChangePlanDialog = ({ organisationId, plan, isCurrent, isDowngrade }: ChangePlanDialogProps) => {
  const { t } = useLinguiMacro();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: changePlan, isPending } = trpc.enterprise.billing.plan.change.useMutation();

  const planName = plan.name;

  const onConfirm = async () => {
    try {
      await changePlan({ organisationId, claimId: plan.id });

      await utils.enterprise.billing.get.invalidate({ organisationId });

      setIsOpen(false);
      toast({ title: t`Plan updated.` });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: t`We could not change the plan.`,
        description: error.userMessage ?? t`Please try again.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(value) => !isPending && setIsOpen(value)}>
      <DialogTrigger asChild>
        <Button variant={isCurrent ? 'secondary' : 'default'}>
          {isCurrent ? <Trans>Keep this plan</Trans> : <Trans>Choose plan</Trans>}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCurrent ? <Trans>Keep {planName}</Trans> : <Trans>Switch to {planName}</Trans>}</DialogTitle>

          <DialogDescription>
            <ChangePlanEffect isCurrent={isCurrent} isDowngrade={isDowngrade} />
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={isPending}>
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button loading={isPending} onClick={() => void onConfirm()}>
            <Trans>Confirm</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Downgrades wait for the 1st so the month in use is billed at the current
// plan; upgrades apply right away and are billed in full on the 1st.
const ChangePlanEffect = ({ isCurrent, isDowngrade }: { isCurrent: boolean; isDowngrade: boolean }) => {
  if (isCurrent) {
    return <Trans>The scheduled plan change is cancelled.</Trans>;
  }

  if (isDowngrade) {
    return <Trans>The new plan starts on the 1st of next month.</Trans>;
  }

  return <Trans>The new plan starts now. Its monthly fee is billed on the 1st.</Trans>;
};
