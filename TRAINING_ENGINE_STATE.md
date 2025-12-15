# Training Engine – Last Known Good State

## What Works

- AI generates full training plans (phases, weeks, days, mileage)
- RuleSets + MustHaves live in DB
- Frontend renders preview from Redis without heavy inference
- totalWeeks derived from startDate → raceDate
- Preferred days respected
- Phases stable (Base 4, Peak 6, Build = remainder, Taper 2)

## Core Architectural Principle

The AI is the source of truth for:
- week structure
- mileage distribution
- preferred day usage
- phase logic

The frontend must NOT:
- calculate dates
- infer week ranges
- reinterpret race timing

## Known Gaps (Intentional)

- Dates not yet embedded in AI output (weekStartDate, day.date)
- Frontend still computes some date ranges
- Final-week race-day semantics need formal rule
- N+ progression logic needs refinement

## Next Planned Improvements

1. Move all date calculation into AI output
2. Enforce dates via ReturnJsonFormat
3. Add final-week / race-day guardrails
4. Reduce frontend logic to pure rendering

## Why This Matters

This avoids UI bugs, timezone issues, and logic duplication.
