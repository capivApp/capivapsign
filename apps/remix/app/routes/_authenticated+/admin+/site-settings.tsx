import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import { SITE_SETTINGS_BANNER_ID } from '@documenso/lib/server-only/site-settings/schemas/banner';
import { SITE_SETTINGS_EMAIL_BLOCKLIST_ID } from '@documenso/lib/server-only/site-settings/schemas/email-blocklist';
import { SITE_SETTINGS_SIGNING_TIMESTAMP_ID } from '@documenso/lib/server-only/site-settings/schemas/signing-timestamp';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { AdminEmailBlocklistSection } from '~/components/general/admin-email-blocklist-section';
import { AdminSigningTimestampSection } from '~/components/general/admin-signing-timestamp-section';
import { AdminSiteBannerSection } from '~/components/general/admin-site-banner-section';
import { SettingsHeader } from '~/components/general/settings-header';
import type { Route } from './+types/site-settings';

export async function loader() {
  const settings = await getSiteSettings();

  const banner = settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID);
  const emailBlocklist = settings.find((setting) => setting.id === SITE_SETTINGS_EMAIL_BLOCKLIST_ID);
  const signingTimestamp = settings.find((setting) => setting.id === SITE_SETTINGS_SIGNING_TIMESTAMP_ID);

  return { banner, emailBlocklist, signingTimestamp };
}

export default function AdminSiteSettingsPage({ loaderData }: Route.ComponentProps) {
  const { banner, emailBlocklist, signingTimestamp } = loaderData;

  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader title={_(msg`Site Settings`)} subtitle={_(msg`Manage your site settings here`)} />

      <div className="mt-8 space-y-12">
        <AdminSiteBannerSection banner={banner} />

        <AdminSigningTimestampSection signingTimestamp={signingTimestamp} />

        <AdminEmailBlocklistSection emailBlocklist={emailBlocklist} />
      </div>
    </div>
  );
}
