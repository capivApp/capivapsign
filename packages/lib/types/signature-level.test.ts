import { describe, expect, it } from 'vitest';

import {
  isIcpEnvelope,
  isLocalAgentEnvelope,
  isPadesPipelineEnvelope,
  isTspEnvelope,
} from './signature-level';

/**
 * Offline guard for the signature-level routing predicates. These decide which
 * envelopes run the shared PAdES pipeline (anchors -> capture -> embed -> seal)
 * and which sign via a local agent vs a cloud TSP — getting them wrong silently
 * mis-routes the seal handler and send-time materialisation.
 */
describe('signature-level routing predicates', () => {
  it('routes AES/QES through the TSP pipeline only', () => {
    for (const level of ['AES', 'QES']) {
      expect(isTspEnvelope({ signatureLevel: level })).toBe(true);
      expect(isIcpEnvelope({ signatureLevel: level })).toBe(false);
      expect(isLocalAgentEnvelope({ signatureLevel: level })).toBe(false);
      expect(isPadesPipelineEnvelope({ signatureLevel: level })).toBe(true);
    }
  });

  it('routes ICP through the local-agent pipeline only', () => {
    const icp = { signatureLevel: 'ICP' };
    expect(isIcpEnvelope(icp)).toBe(true);
    expect(isLocalAgentEnvelope(icp)).toBe(true);
    expect(isTspEnvelope(icp)).toBe(false);
    expect(isPadesPipelineEnvelope(icp)).toBe(true);
  });

  it('keeps SES (and unknown values) out of every PAdES path', () => {
    for (const level of ['SES', 'garbage', '']) {
      expect(isTspEnvelope({ signatureLevel: level })).toBe(false);
      expect(isIcpEnvelope({ signatureLevel: level })).toBe(false);
      expect(isPadesPipelineEnvelope({ signatureLevel: level })).toBe(false);
    }
  });
});
