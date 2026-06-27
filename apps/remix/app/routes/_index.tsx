import { extractCookieFromHeaders } from '@documenso/auth/server/lib/utils/cookies';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { getPublicPricingClaims } from '@documenso/lib/server-only/subscription/get-public-pricing-claims';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import { redirect } from 'react-router';

import { LandingPage } from '~/components/general/landing-page';

import type { Route } from './+types/_index';

export function meta() {
  return [
    { title: 'CapivaSign — Assinatura digital com validade jurídica' },
    {
      name: 'description',
      content:
        'Assinatura eletrônica e ICP-Brasil com WhatsApp e API. Simples, rápida e com validade jurídica.',
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  if (session.isAuthenticated) {
    const teamUrlCookie = extractCookieFromHeaders('preferred-team-url', request.headers);

    // const referrer = request.headers.get('referer');
    // let isReferrerFromTeamUrl = false;

    // if (referrer) {
    //   const referrerUrl = new URL(referrer);

    //   if (referrerUrl.pathname.startsWith('/t/')) {
    //     isReferrerFromTeamUrl = true;
    //   }
    // }

    const preferredTeamUrl =
      teamUrlCookie && ZTeamUrlSchema.safeParse(teamUrlCookie).success ? teamUrlCookie : undefined;

    // // Early return for no preferred team.
    // if (!preferredTeamUrl || isReferrerFromTeamUrl) {
    //   throw redirect('/inbox');
    // }

    const teams = await getTeams({ userId: session.user.id });

    let currentTeam = teams.find((team) => team.url === preferredTeamUrl);

    if (!currentTeam && teams.length === 1) {
      currentTeam = teams[0];
    }

    if (!currentTeam) {
      throw redirect('/inbox');
    }

    throw redirect(formatDocumentsPath(currentTeam.url));
  }

  // Unauthenticated visitors land on the public marketing page (no redirect).
  // Public signing-by-link routes live under `_recipient+` and remain accessible
  // without an account — unaffected by this.
  const pricingClaims = await getPublicPricingClaims();

  return { pricingClaims };
}

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  return <LandingPage pricingClaims={loaderData?.pricingClaims ?? []} />;
}
