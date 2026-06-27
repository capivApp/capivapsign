import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`API Keys`);
}

const EXPIRATION_OPTIONS = ['ONE_WEEK', 'ONE_MONTH', 'THREE_MONTHS', 'SIX_MONTHS', 'ONE_YEAR'] as const;
const NONE = '__none__';

export default function OrganisationApiKeysPage() {
  const { t, i18n } = useLingui();
  const { toast } = useToast();
  const organisation = useCurrentOrganisation();

  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [memberUserId, setMemberUserId] = useState<string>(NONE);
  const [expiration, setExpiration] = useState<string>(NONE);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const { data: tokensData, isLoading, refetch } = trpc.organisation.apiToken.find.useQuery({
    organisationId: organisation.id,
  });
  const { data: teamsData } = trpc.team.find.useQuery({ organisationId: organisation.id });
  const { data: membersData } = trpc.organisation.member.find.useQuery({ organisationId: organisation.id });

  const { mutateAsync: createToken, isPending: isCreating } = trpc.organisation.apiToken.create.useMutation();
  const { mutateAsync: deleteToken } = trpc.organisation.apiToken.delete.useMutation();

  const teams = teamsData?.data ?? [];
  const members = membersData?.data ?? [];
  const tokens = tokensData?.data ?? [];

  const onCreate = async () => {
    try {
      const { token } = await createToken({
        organisationId: organisation.id,
        teamId: Number(teamId),
        tokenName: name,
        expirationDate: expiration === NONE ? null : expiration,
        targetUserId: memberUserId === NONE ? null : Number(memberUserId),
      });

      setCreatedToken(token);
      setName('');
      setMemberUserId(NONE);
      setExpiration(NONE);
      toast({ title: t`API key created` });
      void refetch();
    } catch (err) {
      toast({
        title: t`Failed to create API key`,
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const onDelete = async (id: number) => {
    await deleteToken({ organisationId: organisation.id, id }).catch(() => undefined);
    void refetch();
  };

  if (isLoading) {
    return <SpinnerBox />;
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`API Keys`}
        subtitle={t`Create organisation API keys for integrations, optionally scoped to a specific member. Usage is billed per the organisation plan.`}
      />

      {createdToken && (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>
            <Trans>Copy your API key now</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>You won't be able to see it again.</Trans>
            <code className="mt-2 block break-all rounded bg-muted p-2 text-xs">{createdToken}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <Label className="text-xs">
            <Trans>Name</Trans>
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t`e.g. Integration key`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">
              <Trans>Team</Trans>
            </Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder={t`Select a team`} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              <Trans>Member (optional)</Trans>
            </Label>
            <Select value={memberUserId} onValueChange={setMemberUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t`Organisation (owner)`}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={String(member.userId)}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">
            <Trans>Expiration</Trans>
          </Label>
          <Select value={expiration} onValueChange={setExpiration}>
            <SelectTrigger>
              <SelectValue placeholder={t`No expiration`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t`No expiration`}</SelectItem>
              {EXPIRATION_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.replace(/_/g, ' ').toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end">
          <Button loading={isCreating} disabled={name.trim().length < 3 || !teamId} onClick={onCreate}>
            <Trans>Create API key</Trans>
          </Button>
        </div>
      </div>

      <hr className="my-6" />

      <h4 className="text-base font-medium">
        <Trans>Existing keys</Trans>
      </h4>

      {tokens.length === 0 ? (
        <p className="mt-2 text-sm italic text-muted-foreground">
          <Trans>No API keys yet.</Trans>
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h5 className="text-sm font-medium">{token.name}</h5>
                <p className="mt-1 text-xs text-muted-foreground">
                  {token.teamName}
                  {token.userEmail ? ` · ${token.userName || token.userEmail}` : ` · ${t`Organisation`}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Trans>Created {i18n.date(token.createdAt, DateTime.DATETIME_MED)}</Trans>
                  {token.expires
                    ? ` · ${t`expires`} ${i18n.date(token.expires, DateTime.DATETIME_MED)}`
                    : ` · ${t`no expiration`}`}
                </p>
              </div>

              <Button variant="destructive" onClick={async () => onDelete(token.id)}>
                <Trans>Delete</Trans>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
