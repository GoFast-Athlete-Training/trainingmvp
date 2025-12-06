const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...\n');

    // Check which tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name = 'athletes' OR table_name = 'Athlete')
      ORDER BY table_name;
    `;
    
    console.log('📊 Athlete table check:');
    console.log(tables);
    console.log('');

    // Try to count rows in athletes (lowercase)
    try {
      const athletesCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "athletes"
      `;
      console.log('✅ athletes table (lowercase):');
      console.log(`   Row count: ${athletesCount[0].count}`);
    } catch (e) {
      console.log('❌ athletes table (lowercase) does not exist or error:', e.message);
    }

    // Try to count rows in Athlete (PascalCase)
    try {
      const AthleteCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Athlete"
      `;
      console.log('✅ Athlete table (PascalCase):');
      console.log(`   Row count: ${AthleteCount[0].count}`);
    } catch (e) {
      console.log('❌ Athlete table (PascalCase) does not exist or error:', e.message);
    }

    // Check for backup tables
    const backups = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%backup%' OR table_name LIKE '%_backup_%')
      ORDER BY table_name;
    `;
    
    console.log('\n💾 Backup tables found:');
    console.log(backups.length > 0 ? backups : '   No backup tables found');

    // Check training plans
    try {
      const planCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "TrainingPlan"
      `;
      console.log(`\n📋 Training Plans: ${planCount[0].count}`);
    } catch (e) {
      console.log('\n❌ Could not check TrainingPlan:', e.message);
    }

    // Try to query athletes using Prisma (this will tell us if mapping works)
    try {
      const athletes = await prisma.athlete.findMany({ take: 5 });
      console.log(`\n✅ Prisma query successful! Found ${athletes.length} athletes (showing first 5)`);
      athletes.forEach(a => {
        console.log(`   - ${a.id}: ${a.email || a.firebaseId}`);
      });
    } catch (e) {
      console.log('\n❌ Prisma query failed:', e.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

