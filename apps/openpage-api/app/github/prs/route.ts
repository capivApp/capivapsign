import cors from '@/lib/cors';
import { GITHUB_REPO, noRepoConfiguredBody } from '@/lib/github-repo';

export async function GET(request: Request) {
  if (!GITHUB_REPO) {
    return cors(
      request,
      new Response(noRepoConfiguredBody, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  }

  const res = await fetch(
    `https://api.github.com/search/issues?q=repo:${GITHUB_REPO}+is:pr+merged:>=2010-01-01&page=0&per_page=1`,
  );
  const { total_count } = await res.json();

  return cors(
    request,
    new Response(JSON.stringify({ data: total_count }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }),
  );
}

export function OPTIONS(request: Request) {
  return cors(
    request,
    new Response(null, {
      status: 204,
    }),
  );
}
