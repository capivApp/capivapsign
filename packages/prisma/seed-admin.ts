import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { createPersonalOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { Role } from '@prisma/client';

import { prisma } from '.';

/**
 * Minimal, standalone seed: creates a single admin user and the bare minimum it
 * needs to operate (a personal organisation + team). It is intentionally NOT
 * placed under `./seed`, so `npm run prisma:seed` (the demo data seeder) never
 * picks it up — run it on its own with `npm run prisma:seed-admin`.
 *
 * The internal subscription claims (Free, etc.) are seeded by the migrations, so
 * they are already present once the database is migrated.
 *
 * Configure via env (all optional):
 *   SEED_ADMIN_NAME      (default: "Admin")
 *   SEED_ADMIN_EMAIL     (default: "admin@capivapp.com.br")
 *   SEED_ADMIN_PASSWORD  (default: "password")
 *
 * Re-running is safe: an existing user with the same email is only promoted to
 * admin if needed, never recreated.
 */
const ADMIN_NAME = 'Mateus Seiboth';
const ADMIN_EMAIL = 'mateusseiboth@gmail.com';
const ADMIN_PASSWORD = 'O9MCDs55fnRtmO';

const ensureAdminRole = async (userId: number, roles: Role[]) => {
  if (roles.includes(Role.ADMIN)) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { roles: [...roles, Role.ADMIN] },
  });

  console.log(`[SEED:ADMIN]: Promoted existing user ${ADMIN_EMAIL} to admin.`);
};

const seedAdmin = async () => {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    await ensureAdminRole(existing.id, existing.roles);
    console.log(`[SEED:ADMIN]: User ${ADMIN_EMAIL} already exists — nothing else to do.`);

    return;
  }

  const user = await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashSync(ADMIN_PASSWORD),
      emailVerified: new Date(),
      roles: [Role.USER, Role.ADMIN],
    },
  });

  // Every user needs a personal organisation (+ team) to use the app; mirrors
  // the normal signup flow (`onCreateUserHook`).
  await createPersonalOrganisation({
    userId: user.id,
    throwErrorOnOrganisationCreationFailure: true,
  });

  console.log(`[SEED:ADMIN]: Created admin user ${ADMIN_EMAIL} with password "${ADMIN_PASSWORD}".`);
};

seedAdmin()
  .then(() => {
    console.log('[SEED:ADMIN]: Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SEED:ADMIN]: Failed.');
    console.error(error);
    process.exit(1);
  });
