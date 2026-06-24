import { HttpTimestampAuthority, type TimestampAuthority } from '@libpdf/core';

import { resolveCscSealTimeTsa } from '../csc/tsa-resolver';

/**
 * RFC3161 TSA for the ICP-Brasil flow.
 *
 * Unlike the CSC flow — where a TSP may advertise its own `signatures/timestamp`
 * endpoint authorised with a per-recipient bearer — the ICP signer is a local
 * desktop agent with no server-reachable timestamp service. Both the B-T
 * sign-time signature timestamp and the B-LTA seal-time archival timestamp use
 * the operator's env-configured TSA (`NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY`),
 * resolved through the shared CSC env parser so there's no drift.
 *
 * First URL only; multi-TSA fallback can layer on later (Fase 4) via a
 * composite wrapper.
 */
export const resolveIcpTimestampAuthority = (): TimestampAuthority => {
  const { urls } = resolveCscSealTimeTsa();

  return new HttpTimestampAuthority(urls[0]);
};
