/**
 * Quick database connection test
 * Run with: node test-db-connection.js
 */

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('📊 Testing database connection...');
console.log('URL:', DATABASE_URL.substring(0, 50) + '...');

(async () => {
  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(DATABASE_URL);
    
    console.log('⏳ Attempting to connect...');
    
    // Try a simple query
    const result = await sql`SELECT NOW()`;
    console.log('✅ Connection successful!');
    console.log('📅 Server time:', result[0].now);
    
    // Check if users table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `;
    
    if (tableCheck[0].exists) {
      console.log('✅ Users table exists');
      
      // Check user count
      const userCount = await sql`SELECT COUNT(*) as count FROM users`;
      console.log(`📊 Current users in database: ${userCount[0].count}`);
    } else {
      console.log('❌ Users table does not exist - need to run migrations!');
      console.log('   Run: npm run db:push');
    }
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('1. Verify DATABASE_URL is correct');
    console.error('2. Check that Supabase database is running');
    console.error('3. Check internet connection to Supabase');
    console.error('4. Try running: npm run db:push');
    process.exit(1);
  }
})();
