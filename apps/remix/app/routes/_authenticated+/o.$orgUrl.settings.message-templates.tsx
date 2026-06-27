import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Message Templates`);
}

const PLACEHOLDER_HINT = '{signer.name}, {signer.email}, {document.name}, {team.name}, {link}';

type ChannelCardProps = {
  organisationId: string;
  channel: MessageTemplateChannel;
  title: string;
  withSubject: boolean;
  initial?: { id: string; subject: string | null; body: string };
  onSaved: () => void;
};

const ChannelCard = ({ organisationId, channel, title, withSubject, initial, onSaved }: ChannelCardProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');

  useEffect(() => {
    setSubject(initial?.subject ?? '');
    setBody(initial?.body ?? '');
  }, [initial?.subject, initial?.body]);

  const { mutateAsync: upsert, isPending: isSaving } = trpc.organisation.messageTemplate.upsert.useMutation();
  const { mutateAsync: remove, isPending: isResetting } = trpc.organisation.messageTemplate.delete.useMutation();

  const onSave = async () => {
    try {
      await upsert({
        organisationId,
        channel,
        event: ('SIGNING_REQUEST' as MessageTemplateEvent),
        subject: withSubject ? subject || null : null,
        body,
      });
      toast({ title: t`Template saved` });
      onSaved();
    } catch {
      toast({ title: t`Failed to save template`, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        <Trans>Placeholders:</Trans> {PLACEHOLDER_HINT}
      </p>

      <div className="mt-4 space-y-3">
        {withSubject && (
          <div>
            <Label className="text-xs">
              <Trans>Subject</Trans>
            </Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}

        <div>
          <Label className="text-xs">
            <Trans>Message</Trans>
          </Label>
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            loading={isResetting}
            disabled={!initial}
            onClick={async () => {
              if (!initial) return;
              // Deletes the org override; sending falls back to the CapivaApp default.
              await remove({ organisationId, id: initial.id }).catch(() => undefined);
              onSaved();
            }}
          >
            <Trans>Reset to default</Trans>
          </Button>
          <Button loading={isSaving} disabled={body.trim().length === 0} onClick={onSave}>
            <Trans>Save</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function OrganisationMessageTemplatesPage() {
  const { t } = useLingui();
  const organisation = useCurrentOrganisation();

  const { data, isLoading, refetch } = trpc.organisation.messageTemplate.find.useQuery({
    organisationId: organisation.id,
  });

  if (isLoading) {
    return <SpinnerBox />;
  }

  const templates = data?.data ?? [];
  const findFor = (channel: MessageTemplateChannel) =>
    templates.find((tpl) => tpl.channel === channel && tpl.event === ('SIGNING_REQUEST' as MessageTemplateEvent));

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Message Templates`}
        subtitle={t`Customise the signing-request message for email and WhatsApp. Empty falls back to the CapivaApp default.`}
      />

      <div className="space-y-6">
        <ChannelCard
          organisationId={organisation.id}
          channel={('EMAIL' as MessageTemplateChannel)}
          title={t`Email · Signing request`}
          withSubject
          initial={findFor(('EMAIL' as MessageTemplateChannel))}
          onSaved={() => void refetch()}
        />

        <ChannelCard
          organisationId={organisation.id}
          channel={('WHATSAPP' as MessageTemplateChannel)}
          title={t`WhatsApp · Signing request`}
          withSubject={false}
          initial={findFor(('WHATSAPP' as MessageTemplateChannel))}
          onSaved={() => void refetch()}
        />
      </div>
    </div>
  );
}
