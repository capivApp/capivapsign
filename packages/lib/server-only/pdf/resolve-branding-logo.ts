import { getFileServerSide } from '../../universal/upload/get-file.server';
import { getTeamSettings } from '../team/get-team-settings';

/**
 * Resolve a team's white-label branding logo bytes, or `undefined` when branding
 * is disabled / unset / unreadable. Shared by the verification mark and the ICP
 * audit page so both honour the organisation's white-label logo (falling back to
 * the bundled CapivaSign logo at the render site).
 *
 * Best-effort: any failure resolves to `undefined`.
 */
export const resolveBrandingLogoBytes = async (teamId: number | null): Promise<Uint8Array | undefined> => {
  if (teamId === null) {
    return undefined;
  }

  const settings = await getTeamSettings({ teamId }).catch(() => null);

  if (!settings?.brandingEnabled || !settings.brandingLogo) {
    return undefined;
  }

  return getFileServerSide(JSON.parse(settings.brandingLogo)).catch(() => undefined);
};
