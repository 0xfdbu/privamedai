// Production Claim Parser - Maps Natural Language to Contract Circuits
// Each rule maps to a specific parametric verification circuit in PrivaMedAI.compact

export type CircuitName = 
  | 'verifyAgeRange'
  | 'verifyDiabetesTrialEligibility' 
  | 'verifyInsuranceWellnessDiscount'
  | 'verifyHealthcareWorkerClearance'
  | 'verifyParametricClaim';

export interface ClaimParameter {
  name: string;
  type: 'uint' | 'bool' | 'string' | 'bytes32';
  value: any;
  description: string;
  witnessName?: string; // Maps to contract witness
}

export interface ClaimRule {
  id: string;
  category: 'clinical_trial' | 'insurance' | 'employment' | 'travel' | 'education' | 'custom';
  description: string;
  naturalLanguage: string;
  compactRule: string;
  circuit: CircuitName;
  circuitParams: Record<string, any>;
  parameters: ClaimParameter[];
  requiredCredentials: string[];
  privacyLevel: 'low' | 'medium' | 'high';
  resultDescription: string; // What the verifier learns (minimal disclosure)
}

// ═════════════════════════════════════════════════════════════════════════════
// PRESET CLAIM RULES - Map directly to contract circuits
// ═════════════════════════════════════════════════════════════════════════════

export const PRESET_CLAIMS: Record<string, ClaimRule> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Clinical Trials
  // ───────────────────────────────────────────────────────────────────────────
  
  'diabetes_trial_phase3': {
    id: 'diabetes_trial_phase3',
    category: 'clinical_trial',
    description: 'Phase 3 Diabetes Treatment Trial Eligibility',
    naturalLanguage: 'Patient is eligible for Phase 3 diabetes trial: age 40-75, diagnosed with Type 2 diabetes, HbA1c between 7-10%, no recent cardiovascular events',
    compactRule: 'verifyDiabetesTrialEligibility(commitment)',
    circuit: 'verifyDiabetesTrialEligibility',
    circuitParams: {},
    parameters: [
      { name: 'age', type: 'uint', value: 55, description: 'Patient age in years', witnessName: 'get_age' },
      { name: 'hasT2Diabetes', type: 'bool', value: true, description: 'Has Type 2 diabetes diagnosis', witnessName: 'has_diabetes_type2' },
      { name: 'hba1c', type: 'uint', value: 800, description: 'HbA1c level (tenths of percent)', witnessName: 'get_hba1c_level' },
      { name: 'hasCVHistory', type: 'bool', value: false, description: 'No CV history', witnessName: 'has_cardiovascular_history' },
    ],
    requiredCredentials: ['diagnosis_diabetes_t2', 'lab_hba1c', 'cardiovascular_history'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: ELIGIBLE or NOT ELIGIBLE (nothing else)',
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Insurance
  // ───────────────────────────────────────────────────────────────────────────
  
  'insurance_wellness_discount': {
    id: 'insurance_wellness_discount',
    category: 'insurance',
    description: 'Health Insurance Wellness Discount',
    naturalLanguage: 'Eligible for insurance wellness discount: non-smoker, BMI under 30, annual wellness exam completed, vaccination up to date',
    compactRule: 'verifyInsuranceWellnessDiscount(commitment)',
    circuit: 'verifyInsuranceWellnessDiscount',
    circuitParams: {},
    parameters: [
      { name: 'nonSmoker', type: 'bool', value: true, description: 'Non-smoker', witnessName: 'is_non_smoker' },
      { name: 'bmi', type: 'uint', value: 250, description: 'BMI (tenths, e.g., 250 = 25.0)', witnessName: 'get_bmi' },
      { name: 'wellnessExam', type: 'bool', value: true, description: 'Annual wellness exam current', witnessName: 'has_wellness_exam_current' },
      { name: 'vaccinations', type: 'bool', value: true, description: 'Vaccinations up to date', witnessName: 'has_vaccinations_current' },
    ],
    requiredCredentials: ['tobacco_status', 'vitals_bmi', 'wellness_exam', 'immunization_record'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: QUALIFIES for discount or NOT (no health details)',
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Employment
  // ───────────────────────────────────────────────────────────────────────────
  
  'healthcare_worker_clearance': {
    id: 'healthcare_worker_clearance',
    category: 'employment',
    description: 'Healthcare Worker Medical Clearance',
    naturalLanguage: 'Medically cleared for healthcare employment: TB clearance and Hep B immunity',
    compactRule: 'verifyHealthcareWorkerClearance(commitment)',
    circuit: 'verifyHealthcareWorkerClearance',
    circuitParams: {},
    parameters: [
      { name: 'tbClearance', type: 'bool', value: true, description: 'TB clearance', witnessName: 'has_tb_clearance' },
      { name: 'hepBImmunity', type: 'bool', value: true, description: 'Hepatitis B immunity', witnessName: 'has_hep_b_immunity' },
    ],
    requiredCredentials: ['tb_screening', 'hep_b_titer'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: CLEARED or NOT CLEARED (specific conditions hidden)',
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Age Verification
  // ───────────────────────────────────────────────────────────────────────────
  
  'adult_age_verification': {
    id: 'adult_age_verification',
    category: 'custom',
    description: 'Adult Age Verification (18+)',
    naturalLanguage: 'Verified adult: age 18 or older',
    compactRule: 'verifyAgeRange(commitment, 18, 150)',
    circuit: 'verifyAgeRange',
    circuitParams: { minAge: 18, maxAge: 150 },
    parameters: [
      { name: 'age', type: 'uint', value: 35, description: 'Age in years', witnessName: 'get_age' },
    ],
    requiredCredentials: ['government_id', 'birth_certificate'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: IS ADULT or NOT (exact age hidden)',
  },
  
  'senior_citizen_verification': {
    id: 'senior_citizen_verification',
    category: 'custom',
    description: 'Senior Citizen Verification (65+)',
    naturalLanguage: 'Verified senior citizen: age 65 or older',
    compactRule: 'verifyAgeRange(commitment, 65, 150)',
    circuit: 'verifyAgeRange',
    circuitParams: { minAge: 65, maxAge: 150 },
    parameters: [
      { name: 'age', type: 'uint', value: 72, description: 'Age in years', witnessName: 'get_age' },
    ],
    requiredCredentials: ['government_id'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: IS SENIOR or NOT (exact age hidden)',
  },
  
  'age_range_40_65': {
    id: 'age_range_40_65',
    category: 'custom',
    description: 'Age Range Verification (40-65)',
    naturalLanguage: 'Age between 40 and 65 years',
    compactRule: 'verifyAgeRange(commitment, 40, 65)',
    circuit: 'verifyAgeRange',
    circuitParams: { minAge: 40, maxAge: 65 },
    parameters: [
      { name: 'age', type: 'uint', value: 50, description: 'Age in years', witnessName: 'get_age' },
    ],
    requiredCredentials: ['government_id'],
    privacyLevel: 'high',
    resultDescription: 'Verifier learns: IN RANGE or NOT (exact age hidden)',
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// KEYWORD-BASED PATTERN MATCHING
// ═════════════════════════════════════════════════════════════════════════════

export function parseClaimPattern(input: string): ClaimRule | null {
  const lower = input.toLowerCase();
  
  // Clinical trials
  if (lower.includes('diabetes') && (lower.includes('trial') || lower.includes('study'))) {
    return PRESET_CLAIMS.diabetes_trial_phase3;
  }
  
  // Insurance
  if ((lower.includes('insurance') || lower.includes('premium')) && 
      (lower.includes('discount') || lower.includes('wellness') || lower.includes('saving'))) {
    return PRESET_CLAIMS.insurance_wellness_discount;
  }
  
  // Employment
  if ((lower.includes('healthcare') || lower.includes('hospital')) && 
      (lower.includes('worker') || lower.includes('employee') || lower.includes('clearance') || lower.includes('job'))) {
    return PRESET_CLAIMS.healthcare_worker_clearance;
  }
  if (lower.includes('tb') || lower.includes('hepatitis') || lower.includes('hep b')) {
    return PRESET_CLAIMS.healthcare_worker_clearance;
  }
  
  // Age verification
  if ((lower.includes('adult') || lower.includes('over 18') || lower.includes('18+')) && 
      lower.includes('age')) {
    return PRESET_CLAIMS.adult_age_verification;
  }
  if ((lower.includes('senior') || lower.includes('elderly') || lower.includes('65+') || lower.includes('over 65')) && 
      lower.includes('age')) {
    return PRESET_CLAIMS.senior_citizen_verification;
  }
  if ((lower.includes('40') || lower.includes('middle age')) && lower.includes('age')) {
    return PRESET_CLAIMS.age_range_40_65;
  }
  
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// SIMILAR CLAIM SUGGESTIONS
// ═════════════════════════════════════════════════════════════════════════════

export function suggestSimilarClaims(input: string): ClaimRule[] {
  const allClaims = Object.values(PRESET_CLAIMS);
  
  const scored = allClaims.map(claim => {
    const claimText = (claim.naturalLanguage + ' ' + claim.description + ' ' + claim.category).toLowerCase();
    const inputWords = input.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const score = inputWords.filter(word => claimText.includes(word)).length;
    return { claim, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.claim);
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM RULE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildCustomAgeRule(minAge: number, maxAge: number): ClaimRule {
  return {
    id: `custom_age_${minAge}_${maxAge}_${Date.now()}`,
    category: 'custom',
    description: `Custom Age Verification (${minAge}-${maxAge})`,
    naturalLanguage: `Age between ${minAge} and ${maxAge} years`,
    compactRule: `verifyAgeRange(commitment, ${minAge}, ${maxAge})`,
    circuit: 'verifyAgeRange',
    circuitParams: { minAge, maxAge },
    parameters: [
      { name: 'age', type: 'uint', value: Math.floor((minAge + maxAge) / 2), description: 'Age in years', witnessName: 'get_age' },
    ],
    requiredCredentials: ['government_id'],
    privacyLevel: 'high',
    resultDescription: `Verifier learns: AGE ${minAge}-${maxAge} or NOT (exact age hidden)`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// CIRCUIT PARAMETER BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

export function buildCircuitParams(rule: ClaimRule): any[] {
  switch (rule.circuit) {
    case 'verifyAgeRange':
      return [rule.circuitParams.minAge, rule.circuitParams.maxAge];
    case 'verifyDiabetesTrialEligibility':
    case 'verifyInsuranceWellnessDiscount':
    case 'verifyHealthcareWorkerClearance':
      return []; // No additional params needed - witnesses provide data
    case 'verifyParametricClaim':
      return [rule.circuitParams.expectedClaimHash];
    default:
      return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// WITNESS DATA COLLECTOR
// Prepares witness values for proof generation
// ═════════════════════════════════════════════════════════════════════════════

export interface WitnessValues {
  [witnessName: string]: any;
}

export function collectWitnessValues(rule: ClaimRule, userData: WitnessValues): WitnessValues {
  const values: WitnessValues = {};
  
  for (const param of rule.parameters) {
    if (param.witnessName && userData[param.witnessName] !== undefined) {
      values[param.witnessName] = userData[param.witnessName];
    } else if (param.witnessName) {
      // Use default value if user data not provided
      values[param.witnessName] = param.value;
    }
  }
  
  return values;
}

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM CATEGORIES WITH ICONS
// ═════════════════════════════════════════════════════════════════════════════

export const CATEGORY_INFO: Record<string, { icon: string; label: string; color: string }> = {
  clinical_trial: { icon: '🧬', label: 'Clinical Trials', color: '#8b5cf6' },
  insurance: { icon: '🛡️', label: 'Insurance', color: '#3b82f6' },
  employment: { icon: '💼', label: 'Employment', color: '#10b981' },
  travel: { icon: '✈️', label: 'Travel', color: '#f59e0b' },
  education: { icon: '🎓', label: 'Education', color: '#ec4899' },
  custom: { icon: '⚙️', label: 'Custom', color: '#6b7280' },
};
