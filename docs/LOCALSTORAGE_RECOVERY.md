# LocalStorage Data Recovery

## Check Browser LocalStorage

Open browser console and run:
```javascript
// Check athlete data
const athlete = localStorage.getItem('athlete');
if (athlete) {
  console.log('Athlete:', JSON.parse(athlete));
}

// Check training plan
const trainingPlan = localStorage.getItem('trainingPlan');
if (trainingPlan) {
  console.log('Training Plan:', JSON.parse(trainingPlan));
}

// List all keys
console.log('All localStorage keys:', Object.keys(localStorage));
```

## Recovery Options

### If Athlete Data Exists in LocalStorage:

1. **Athlete will be recreated automatically** when you sign in
   - Firebase account still exists
   - `/api/athlete/create` will create new athlete record
   - Profile data can be restored from localStorage if needed

2. **Training Plans** - May need to be regenerated:
   - If plan data exists in localStorage, you can use it to recreate
   - Or start fresh with new training setup

### Recovery Script

If you have athlete data in localStorage, you can manually restore:

```javascript
// In browser console
const athleteData = JSON.parse(localStorage.getItem('athlete'));
console.log('Athlete ID:', athleteData.id);
console.log('Firebase ID:', athleteData.firebaseId);
console.log('Training Plans:', athleteData.trainingPlans);
```

## Current Status

- ✅ Athlete table recreated (structure restored)
- ✅ go_fast_companies table created
- ⚠️  User data: Needs to be recreated (Firebase accounts still exist)
- ⚠️  Training plans: May need to be regenerated

## Next Steps

1. Sign in again - athlete will be created automatically
2. Check localStorage for any saved training data
3. If training plans exist in localStorage, we can help recreate them

