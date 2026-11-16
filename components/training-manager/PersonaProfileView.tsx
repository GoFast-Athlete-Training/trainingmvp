import type { PersonaTrainingProfile, SourcedText } from "@/lib/training/persona-training-profile";
import { Children, type ReactNode } from "react";

export type PersonaProfileSource = {
  title: string;
  capability?: string | null;
  dedication?: string | null;
  personaGoalLabel?: string | null;
  intentSummary?: string | null;
  athletePersonaSummary?: string | null;
  trainingProfile?: PersonaTrainingProfile | null;
};

function FactLine({ label, fact }: { label: string; fact?: SourcedText | null }) {
  if (!fact?.value) return null;
  return (
    <p className="text-gray-700">
      <span className="font-medium text-gray-900">{label}. </span>
      {fact.value}
      {fact.source === "inferred" ? (
        <span className="ml-2 text-xs uppercase tracking-wide text-gray-500">inferred</span>
      ) : null}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {items}
    </div>
  );
}

export function PersonaProfileView({ persona }: { persona: PersonaProfileSource }) {
  const profile = persona.trainingProfile;
  if (!profile) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-gray-900">{persona.title}</p>
        <p className="text-gray-600">
          {persona.capability?.toLowerCase() ?? "unspecified"}
          {persona.dedication ? ` · ${persona.dedication.toLowerCase()} dedication` : ""}
          {persona.personaGoalLabel ? ` · ${persona.personaGoalLabel}` : ""}
        </p>
        {persona.athletePersonaSummary ? (
          <p className="text-gray-700">{persona.athletePersonaSummary}</p>
        ) : null}
        {persona.intentSummary && persona.intentSummary !== persona.athletePersonaSummary ? (
          <p className="text-gray-600">{persona.intentSummary}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <Section title="Identity">
        <p className="text-gray-700">
          <span className="font-medium text-gray-900">Name. </span>
          {persona.title}
        </p>
        <FactLine label="Experience" fact={profile.experience} />
        <FactLine label="Primary goal" fact={profile.primaryGoal} />
        <FactLine label="Target distance" fact={profile.targetDistance} />
      </Section>
      <Section title="Training profile">
        <FactLine label="Weekly mileage" fact={profile.weeklyMileage} />
        <FactLine label="Intensity tolerance" fact={profile.intensityTolerance} />
        <FactLine label="Volume tolerance" fact={profile.volumeTolerance} />
        <FactLine label="Training frequency" fact={profile.trainingFrequency} />
        <FactLine label="Aerobic foundation" fact={profile.aerobicFoundation} />
      </Section>
      <Section title="Coaching strategy">
        <FactLine label="Training priorities" fact={profile.trainingPriorities} />
        <FactLine label="Constraints" fact={profile.lifestyleConstraints} />
        <FactLine label="Recovery considerations" fact={profile.recoveryConsiderations} />
        <FactLine label="Coaching philosophy" fact={profile.coachingPhilosophy} />
      </Section>
    </div>
  );
}
