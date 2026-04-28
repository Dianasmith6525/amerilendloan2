import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq, sql, like } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.log('no db'); process.exit(1); }

// Repair any user whose firstName or lastName accidentally got the email
// stored in it (legacy OTP signup bug — see server/routers.ts).
const bad = await db
  .select({ id: users.id, email: users.email, name: users.name, firstName: users.firstName, lastName: users.lastName })
  .from(users)
  .where(sql`${users.firstName} LIKE '%@%' OR ${users.lastName} LIKE '%@%' OR ${users.name} LIKE '%@%'`);

console.log(`Found ${bad.length} rows with email-like name fields`);

for (const u of bad) {
  const updates: any = {};
  if (u.firstName && u.firstName.includes('@')) updates.firstName = null;
  if (u.lastName && u.lastName.includes('@')) updates.lastName = null;
  if (u.name && u.name.includes('@')) updates.name = null;
  if (Object.keys(updates).length === 0) continue;
  await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, u.id));
  console.log(`  repaired #${u.id} ${u.email} →`, updates);
}

console.log('done');
process.exit(0);
