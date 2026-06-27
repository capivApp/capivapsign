import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import {
  MESSAGE_TEMPLATE_CHANNELS,
  MESSAGE_TEMPLATE_EVENTS,
  MESSAGE_TEMPLATE_PLACEHOLDERS,
} from '@documenso/lib/types/message-template';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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

type StoredTemplate = { id: string; channel: string; event: string; subject: string | null; body: string };

type ChannelCardProps = {
  organisationId: string;
  channel: MessageTemplateChannel;
  event: MessageTemplateEvent;
  label: string;
  withSubject: boolean;
  initial?: StoredTemplate;
  onSaved: () => void;
};

const ChannelCard = ({
  organisationId,
  channel,
  event,
  label,
  withSubject,
  initial,
  onSaved,
}: ChannelCardProps) => {
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
        event,
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
      <h4 className="text-sm font-semibold">{label}</h4>

      <div className="mt-3 space-y-3">
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
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={isResetting}
            disabled={!initial}
            onClick={async () => {
              if (!initial) return;
              await remove({ organisationId, id: initial.id }).catch(() => undefined);
              onSaved();
            }}
          >
            <Trans>Reset to default</Trans>
          </Button>
          <Button size="sm" loading={isSaving} disabled={body.trim().length === 0} onClick={onSave}>
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

  const canConfigure = organisation.organisationClaim.flags.whiteLabelBranding ?? false;

  const { data, isLoading, refetch } = trpc.organisation.messageTemplate.find.useQuery(
    { organisationId: organisation.id },
    { enabled: canConfigure },
  );

  const templates: StoredTemplate[] = data?.data ?? [];
  const findFor = (channel: string, event: string) =>
    templates.find((tpl) => tpl.channel === channel && tpl.event === event);

  return (
    <div className="max-w-3xl">
      <SettingsHeader
        title={t`Message Templates`}
        subtitle={t`Customise the email and WhatsApp messages for each notification. Empty falls back to the system default.`}
      />

      {!canConfigure ? (
        <Alert variant="warning">
          <AlertTitle>
            <Trans>White-label required</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>Custom message templates are available on white-label plans.</Trans>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <SpinnerBox />
      ) : (
        <div className="space-y-8">
          <p className="text-muted-foreground text-xs">
            <Trans>Placeholders:</Trans> {MESSAGE_TEMPLATE_PLACEHOLDERS}
          </p>

          {MESSAGE_TEMPLATE_EVENTS.map((eventMeta) => (
            <section key={eventMeta.event}>
              <h3 className="mb-3 text-base font-medium">{eventMeta.label}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {MESSAGE_TEMPLATE_CHANNELS.map((channelMeta) => (
                  <ChannelCard
                    key={channelMeta.channel}
                    organisationId={organisation.id}
                    channel={channelMeta.channel}
                    event={eventMeta.event}
                    label={channelMeta.label}
                    withSubject={channelMeta.withSubject}
                    initial={findFor(channelMeta.channel, eventMeta.event)}
                    onSaved={() => void refetch()}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
