// Vercel sends: Authorization: Bearer <CRON_SECRET>
// Manual curl sends: x-cron-secret: <CRON_SECRET>
// This utility accepts both so the same routes work locally and on Vercel.
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const xHeader = (request.headers as Headers).get("x-cron-secret");
  if (xHeader) return xHeader === expected;

  const auth = (request.headers as Headers).get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7) === expected;

  return false;
}
