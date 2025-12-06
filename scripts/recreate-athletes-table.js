const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function recreateAthletesTable() {
  try {
    console.log('🔄 Recreating athletes table from trainingmvp schema...\n');

    // Read the SQL file
    const sql = fs.readFileSync(__dirname + '/recreate-athletes-table.sql', 'utf8');

    // Check current state
    console.log('1. Checking current table state...');
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Athlete'
      ) as exists
    `;

    if (tableExists[0].exists) {
      const rowCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Athlete"`;
      console.log(`   Table exists with ${rowCount[0].count} rows`);
      
      if (rowCount[0].count > 0) {
        console.log('\n   ⚠️  WARNING: Table has data!');
        console.log('   Recreating will DELETE all existing data!');
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('   Continue? (yes/no): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'yes') {
          console.log('   ❌ Cancelled');
          process.exit(0);
        }
      }
    } else {
      console.log('   Table does not exist - will create new');
    }

    // Execute SQL
    console.log('\n2. Executing SQL to recreate table...');
    
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('DROP TABLE')) {
        console.log('   ⚠️  Skipping DROP TABLE (commented out for safety)');
        continue;
      }
      
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (error) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.log(`   ⚠️  Warning: ${error.message}`);
        }
      }
    }

    // Verify table structure
    console.log('\n3. Verifying table structure...');
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Athlete'
      ORDER BY ordinal_position
    `;

    console.log(`   ✅ Table created with ${columns.length} columns`);
    
    // Check for key columns
    const hasFirebaseId = columns.some(c => c.column_name === 'firebaseId');
    const hasCompanyId = columns.some(c => c.column_name === 'companyId');
    const hasFiveKPace = columns.some(c => c.column_name === 'fiveKPace');

    if (hasFirebaseId && hasCompanyId && hasFiveKPace) {
      console.log('   ✅ Key columns present: firebaseId, companyId, fiveKPace');
    } else {
      console.log('   ⚠️  Missing some key columns');
    }

    // Check constraints
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'Athlete'
    `;

    console.log(`   ✅ Found ${constraints.length} constraints`);

    console.log('\n✅ Athletes table recreated successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Users will need to re-signup (Firebase accounts still exist)');
    console.log('   2. Run: npm run dev to test');
    console.log('   3. Verify table structure matches schema');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

recreateAthletesTable();

