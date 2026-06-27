import {
  MESSAGE_TEMPLATE_CHANNELS,
  MESSAGE_TEMPLATE_EVENTS,
  MESSAGE_TEMPLATE_PLACEHOLDERS,
} from '@documenso/lib/types/message-template';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageTemplateChannel, MessageTemplateEvent } from '@prisma/client';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { SettingsHeader } from '~/components/general/settings-header';

type StoredTemplate = { id: string; channel: string; event: string; subject: string | null; body: string };

type CardProps = {
  channel: MessageTemplateChannel;
  event: MessageTemplateEvent;
  label: string;
  withSubject: boolean;
  initial?: StoredTemplate;
  onSaved: () => void;
};

const DefaultCard = ({ channel, event, label, withSubject, initial, onSaved }: CardProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');

  useEffect(() => {
    setSubject(initial?.subject ?? '');
    setBody(initial?.body ?? '');
  }, [initial?.subject, initial?.body]);

  const { mutateAsync: upsert, isPending: isSaving } = trpc.admin.defaultMessageTemplate.upsert.useMutation();
  const { mutateAsync: remove, isPending: isRemoving } = trpc.admin.defaultMessageTemplate.delete.useMutation();

  const onSave = async () => {
    try {
      await upsert({ channel, event, subject: withSubject ? subject || null : null, body });
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
            loading={isRemoving}
            disabled={!initial}
            onClick={async () => {
              if (!initial) return;
              await remove({ id: initial.id }).catch(() => undefined);
              onSaved();
            }}
          >
            <Trans>Clear</Trans>
          </Button>
          <Button size="sm" loading={isSaving} disabled={body.trim().length === 0} onClick={onSave}>
            <Trans>Save</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function AdminDefaultMessageTemplatesPage() {
  const { t } = useLingui();

  const { data, isLoading, refetch } = trpc.admin.defaultMessageTemplate.find.useQuery();

  const templates: StoredTemplate[] = data?.data ?? [];
  const findFor = (channel: string, event: string) =>
    templates.find((tpl) => tpl.channel === channel && tpl.event === event);

  if (isLoading) {
    return <SpinnerBox />;
  }

  return (
    <div className="max-w-3xl">
      <SettingsHeader
        title={t`Default Message Templates`}
        subtitle={t`System-wide default email and WhatsApp messages. Organisations without their own template fall back to these.`}
      />

      <p className="text-muted-foreground mb-6 text-xs">
        <Trans>Placeholders:</Trans> {MESSAGE_TEMPLATE_PLACEHOLDERS}
      </p>

      <div className="space-y-8">
        {MESSAGE_TEMPLATE_EVENTS.map((eventMeta) => (
          <section key={eventMeta.event}>
            <h3 className="mb-3 text-base font-medium">{eventMeta.label}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {MESSAGE_TEMPLATE_CHANNELS.map((channelMeta) => (
                <DefaultCard
                  key={channelMeta.channel}
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
    </div>
  );
}
