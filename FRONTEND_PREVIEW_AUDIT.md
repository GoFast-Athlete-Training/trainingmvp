# Frontend Training Plan Preview Logic Audit

## Issues Identified

### 1. Total Weeks = N/A
**Location:** Line 242
**Issue:** `preview.totalWeeks || 'N/A'` - If AI doesn't return totalWeeks, shows N/A
**Fix:** Fall back to `preview.weeks?.length || 'N/A'`

### 2. Weeks Not Sorted
**Location:** Line 324
**Issue:** `preview.weeks.map(...)` - No sorting by weekNumber
**Fix:** Sort before mapping: `preview.weeks.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))`

### 3. Date Parsing Timezone Bug (Dec 15 → Dec 14)
**Location:** Lines 33, 71, 83, 92, 269, 273, 327
**Issue:** `new Date(startDateParam)` where startDateParam is "2025-12-15" (YYYY-MM-DD format)
- When parsed, JavaScript interprets this as UTC midnight
- When displayed in local timezone (e.g., PST/PDT), it shows as previous day
**Fix:** Parse date string explicitly as local date, not UTC:
```typescript
// Instead of: new Date("2025-12-15")
// Use: Parse YYYY-MM-DD as local date
const [year, month, day] = startDateParam.split('-').map(Number);
const startDate = new Date(year, month - 1, day);
```

### 4. Date Mutation in Calculations
**Location:** Lines 269-275, 327-328
**Issue:** `setDate()` mutates the Date object, and calculations don't normalize to UTC first
**Fix:** Create new Date objects for each calculation, use UTC methods

### 5. Race Date Not Used for Final Week
**Location:** Missing
**Issue:** Final week end date is calculated from `weeks.length * 7` instead of race date
**Fix:** Load race date and use it as authoritative end date

### 6. "No days scheduled" is Expected
**Location:** Line 382
**Status:** ✅ CORRECT - This is informational, not an error. Weeks can exist without days.

## Files to Fix

1. `/app/training-setup/[trainingPlanId]/preview/page.tsx`
   - Fix date parsing (lines 33, 71, 83, 92)
   - Fix totalWeeks fallback (line 242)
   - Add week sorting (line 324)
   - Fix date calculations (lines 269-275, 327-328)
   - Load and use race date for final week
