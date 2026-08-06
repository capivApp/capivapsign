import cors from '@/lib/cors';
import { githubApiUrl, noRepoConfiguredBody } from '@/lib/github-repo';

export async function GET(request: Request) {
  const url = githubApiUrl('');

  if (!url) {
    return cors(
      request,
      new Response(noRepoConfiguredBody, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  }

  const res = await fetch(url);
  const { stargazers_count } = await res.json();

  return cors(
    request,
    new Response(JSON.stringify({ data: stargazers_count }), {
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
