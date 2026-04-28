import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.log('no db'); process.exit(1); }
const r = await db
  .select({ id: users.id, email: users.email, name: users.name, firstName: users.firstName, lastName: users.lastName, phoneNumber: users.phoneNumber })
  .from(users)
  .where(eq(users.email, 'dianasmith6525@gmail.com'));
console.log(JSON.stringify(r, null, 2));
process.exit(0);
