export interface SafetyScanResult {
  passed: boolean;
  flags: string[];
}

export class SafetyFilter {
  private blockedPatterns: { label: string; regex: RegExp }[] = [
    {
      label: 'shame_or_guilt',
      regex: /\b(you should have|why didn't you|you failed to|why did you miss|you ought to)\b/i,
    },
    {
      label: 'absolutist_claims',
      regex: /\b(this always works|guaranteed to work|never fail|foolproof)\b/i,
    },
    {
      label: 'identity_assumptions',
      regex: /\b(as a developer|since you are a|because you are a)\b/i,
    },
    {
      label: 'medical_advice',
      regex: /\b(diagnose|clinical|therapy|depression|anxiety disorder|prescription|treatment)\b/i,
    },
    {
      label: 'productivity_extremism',
      regex: /\b(sleep less|no excuses|work harder|hustle harder|grind 24\/7|don't stop)\b/i,
    },
    {
      label: 'overdependence',
      regex: /\b(i know what's best for you|i will decide|you must obey|trust me completely)\b/i,
    },
  ];

  public scan(text: string): SafetyScanResult {
    const flags: string[] = [];

    for (const pattern of this.blockedPatterns) {
      if (pattern.regex.test(text)) {
        flags.push(pattern.label);
      }
    }

    return {
      passed: flags.length === 0,
      flags,
    };
  }
}

export const safetyFilter = new SafetyFilter();
