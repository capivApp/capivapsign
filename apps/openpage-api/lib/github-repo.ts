/**
 * Repository the `/github/*` metrics endpoints report on.
 *
 * Configurable rather than hardcoded: this app used to publish the upstream
 * project's star/fork/PR counts, which is both wrong for this product and a
 * visible reference to it. Leave `OPENPAGE_GITHUB_REPO` unset and the endpoints
 * report nothing instead of someone else's numbers.
 *
 * Format: `owner/repo`.
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in turbo.json globalEnv
export const GITHUB_REPO = process.env.OPENPAGE_GITHUB_REPO?.trim() || null;

export const githubApiUrl = (path: string): string | null =>
  GITHUB_REPO ? `https://api.github.com/repos/${GITHUB_REPO}${path}` : null;

/**
 * Response used when no repository is configured. `null` data keeps the shape
 * consumers expect while making it obvious the metric is unavailable.
 */
export const noRepoConfiguredBody = JSON.stringify({ data: null });
