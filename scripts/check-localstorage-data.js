// Script to check localStorage for training data
// Run this in browser console to see what data exists

console.log('🔍 Checking localStorage for training data...\n');

// Check for athlete data
const athlete = localStorage.getItem('athlete');
if (athlete) {
  console.log('✅ Athlete data found in localStorage:');
  const athleteData = JSON.parse(athlete);
  console.log('  - ID:', athleteData.id);
  console.log('  - Name:', athleteData.firstName, athleteData.lastName);
  console.log('  - Email:', athleteData.email);
  console.log('  - Firebase ID:', athleteData.firebaseId);
  console.log('  - 5K Pace:', athleteData.fiveKPace);
  if (athleteData.trainingPlans && athleteData.trainingPlans.length > 0) {
    console.log('  - Training Plans:', athleteData.trainingPlans.length);
    athleteData.trainingPlans.forEach((plan, i) => {
      console.log(`    Plan ${i + 1}: ${plan.name} (${plan.status})`);
    });
  }
} else {
  console.log('❌ No athlete data in localStorage');
}

// Check for training plan data
const trainingPlan = localStorage.getItem('trainingPlan');
if (trainingPlan) {
  console.log('\n✅ Training plan data found in localStorage:');
  const planData = JSON.parse(trainingPlan);
  console.log('  - Plan ID:', planData.id);
  console.log('  - Plan Name:', planData.name);
  console.log('  - Status:', planData.status);
} else {
  console.log('\n❌ No training plan data in localStorage');
}

// Check for other training-related data
const keys = Object.keys(localStorage);
const trainingKeys = keys.filter(k => k.toLowerCase().includes('training') || k.toLowerCase().includes('plan') || k.toLowerCase().includes('athlete'));
if (trainingKeys.length > 0) {
  console.log('\n📋 Other training-related keys in localStorage:');
  trainingKeys.forEach(key => {
    console.log(`  - ${key}`);
  });
}

console.log('\n💡 To recover data:');
console.log('  1. Copy the athlete data from above');
console.log('  2. Use it to recreate athlete record if needed');
console.log('  3. Training plans may need to be regenerated');

