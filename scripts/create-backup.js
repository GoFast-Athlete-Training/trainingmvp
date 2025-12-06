const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupSuffix = timestamp.replace(/-/g, '').slice(0, 14);
    
    console.log(`Creating backup with suffix: ${backupSuffix}`);

    // Create backup of athletes table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS athletes_backup_${backupSuffix} AS 
      SELECT * FROM "athletes"
    `);

    // Get row count
    const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "athletes"`;
    const rowCount = count[0]?.count || 0;

    console.log(`✅ Backup created: athletes_backup_${backupSuffix} (${rowCount} rows)`);

    // Also backup TrainingPlan if it exists
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS TrainingPlan_backup_${backupSuffix} AS 
        SELECT * FROM "TrainingPlan"
      `);
      const planCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "TrainingPlan"`;
      console.log(`✅ Backup created: TrainingPlan_backup_${backupSuffix} (${planCount[0]?.count || 0} rows)`);
    } catch (e) {
      console.log(`⚠️  Could not backup TrainingPlan: ${e.message}`);
    }

    // Save backup info
    const backupInfo = {
      timestamp: new Date().toISOString(),
      suffix: backupSuffix,
      athletes: rowCount,
      tables: ['athletes_backup_' + backupSuffix]
    };

    console.log('\n📋 Backup Summary:');
    console.log(JSON.stringify(backupInfo, null, 2));

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createBackup();

