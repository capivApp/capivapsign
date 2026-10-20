import { describe, expect, it } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { assertMemberCountWithinCap } from './assert-member-count-within-cap';

describe('assertMemberCountWithinCap', () => {
  it('allows any number of members when the plan has no cap', () => {
    expect(() => assertMemberCountWithinCap({ memberCount: 0 }, 500)).not.toThrow();
  });

  it('allows growing up to the cap', () => {
    expect(() => assertMemberCountWithinCap({ memberCount: 5 }, 5)).not.toThrow();
  });

  it('refuses going past the cap', () => {
    expect(() => assertMemberCountWithinCap({ memberCount: 5 }, 6)).toThrowError(
      expect.objectContaining({ code: AppErrorCode.LIMIT_EXCEEDED }),
    );
  });
});
