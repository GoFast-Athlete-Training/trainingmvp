# Onboarding Implementation Summary

## Overview
Implemented a complete onboarding flow for GoFast Training MVP that mirrors the authentication pattern from `gofastapp-mvp` and includes OpenAI-powered inference generation.

## What Was Built

### 1. Authentication Updates
- **Fixed `/api/athlete/create` route** to use upsert pattern (like gofastapp-mvp)
  - Creates or updates athlete based on Firebase ID
  - Returns consistent response format
  - Proper error handling and logging

### 2. Onboarding Page (`/app/onboarding/page.tsx`)
A multi-step onboarding flow with three stages:

#### Step 1: Form
- **Race Name**: Text input for race name (e.g., "Boston Marathon")
- **Race Distance**: Dropdown (5K, 10K, 10 Mile, Half Marathon, Marathon)
- **Goal Time**: Text input (supports HH:MM:SS or MM:SS format)
- **Goal Pace**: Automatically calculated from goal time and race distance
- **Current 5K**: Text input for current 5K pace per mile (MM:SS format)

#### Step 2: Dialogue
- **Last Race Feeling**: Open textarea - "How well do you feel you did your last race?"
- **Training Background**: Open textarea - "Have you trained before?"

#### Step 3: Review
- Displays all collected information
- Shows AI-generated inference
- Save button to persist data

### 3. API Routes

#### `/api/onboarding/inference` (POST)
- Verifies Firebase token
- Sends onboarding data to OpenAI (gpt-4o-mini)
- Generates personalized training insights based on:
  - Goal assessment (realistic given current pace?)
  - Key training focus areas
  - Potential challenges
  - Encouragement and motivation
- Returns inference text

#### `/api/onboarding/save` (POST)
- Verifies Firebase token
- Creates or finds Race record in database
- Updates Athlete record with:
  - `myTargetRace`: Race name
  - `myTrainingGoal`: Goal time
  - `myCurrentPace`: Current 5K pace
- Returns updated athlete data

### 4. Utility Functions

#### Pace Calculations (`lib/utils/pace.ts`)
- `calculateGoalPace(goalTime, raceDistance)`: Calculates goal pace per mile from goal time and distance
- `getRaceDistanceMiles(raceType)`: Converts race type string to miles
- Existing pace utilities maintained

### 5. Signup Flow Updates
- Updated `/app/signup/page.tsx` to:
  - Use new upsert pattern for athlete creation
  - Check if athlete has completed onboarding (`myTargetRace` field)
  - Route to `/onboarding` for new athletes
  - Route to `/training` for athletes with onboarding data

### 6. Training Page Updates
- Added onboarding check in `/app/training/page.tsx`
- Redirects to `/onboarding` if athlete hasn't completed onboarding
- Prevents access to training features without onboarding data

## Flow Diagram

```
User Signs Up
    ↓
Firebase Auth (Google/Email)
    ↓
/api/athlete/create (upsert)
    ↓
Check: Has myTargetRace?
    ├─ Yes → /training
    └─ No → /onboarding
            ↓
        Step 1: Race Info
            ↓
        Step 2: Dialogue Questions
            ↓
        /api/onboarding/inference (OpenAI)
            ↓
        Step 3: Review & Save
            ↓
        /api/onboarding/save
            ↓
        /training
```

## Database Schema
Uses existing Prisma schema:
- `Athlete` model with fields:
  - `myTargetRace`: String?
  - `myTrainingGoal`: String?
  - `myCurrentPace`: String?
- `Race` model for race records

## Environment Variables Required
- `OPENAI_API_KEY`: For inference generation
- Firebase config (same as gofastapp-mvp)
- `DATABASE_URL`: PostgreSQL connection

## OpenAI Model
- Using `gpt-4o-mini` for inference generation
- Temperature: 0.7
- Max tokens: 500

## Next Steps (Optional Enhancements)
1. Add race date field to onboarding (currently defaults to 3 months from now)
2. Store inference text in database (currently only shown in UI)
3. Add ability to edit onboarding data
4. Create training plan automatically after onboarding
5. Add more dialogue questions based on user feedback

## Testing Checklist
- [ ] Sign up with new account → should route to onboarding
- [ ] Complete onboarding form → should calculate goal pace
- [ ] Submit dialogue questions → should generate inference
- [ ] Save onboarding → should update athlete and create race
- [ ] Access training page after onboarding → should work
- [ ] Sign in with existing account (with onboarding) → should route to training
- [ ] Sign in with existing account (without onboarding) → should route to onboarding

