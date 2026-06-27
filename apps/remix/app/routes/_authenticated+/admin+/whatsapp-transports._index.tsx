import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { Input } from '@documenso/ui/primitives/input';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { WhatsappTransportCreateDialog } from '~/components/dialogs/whatsapp-transport-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { AdminWhatsappTransportsTable } from '~/components/tables/admin-whatsapp-transports-table';

export default function AdminWhatsappTransportsPage() {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    // If nothing to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  return (
    <div>
      <SettingsHeader title={t`WhatsApp Transports`} subtitle={t`Manage all WhatsApp transports`} hideDivider>
        <WhatsappTransportCreateDialog />
      </SettingsHeader>

      <div className="mt-4">
        <Input
          defaultValue={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t`Search by name`}
          className="mb-4"
        />

        <AdminWhatsappTransportsTable />
      </div>
    </div>
  );
}
