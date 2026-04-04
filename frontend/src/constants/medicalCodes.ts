/**
 * Medical Code Mappings
 * 
 * Example mappings for condition codes and prescription codes.
 * In a production system, these would be standardized medical coding systems
 * like ICD-10, SNOMED CT, or NDC (National Drug Codes).
 */

export interface CodeMapping {
  code: number;
  name: string;
  description: string;
  category: string;
}

export const CONDITION_CODES: CodeMapping[] = [
  {
    code: 100,
    name: 'Diabetes Mellitus Type 2',
    description: 'A chronic condition affecting glucose metabolism',
    category: 'Endocrine'
  },
  {
    code: 101,
    name: 'Hypertension',
    description: 'High blood pressure condition',
    category: 'Cardiovascular'
  },
  {
    code: 102,
    name: 'Asthma',
    description: 'Chronic inflammatory airway disease',
    category: 'Respiratory'
  },
  {
    code: 103,
    name: 'Chronic Kidney Disease',
    description: 'Progressive loss of kidney function',
    category: 'Nephrology'
  },
  {
    code: 104,
    name: 'Coronary Artery Disease',
    description: 'Narrowing of coronary arteries',
    category: 'Cardiovascular'
  },
  {
    code: 105,
    name: 'COPD',
    description: 'Chronic Obstructive Pulmonary Disease',
    category: 'Respiratory'
  },
  {
    code: 106,
    name: 'Heart Failure',
    description: 'Inability of heart to pump sufficiently',
    category: 'Cardiovascular'
  },
  {
    code: 107,
    name: 'Hypothyroidism',
    description: 'Underactive thyroid gland',
    category: 'Endocrine'
  },
  {
    code: 108,
    name: 'Rheumatoid Arthritis',
    description: 'Autoimmune inflammatory arthritis',
    category: 'Rheumatology'
  },
  {
    code: 109,
    name: 'Epilepsy',
    description: 'Neurological seizure disorder',
    category: 'Neurology'
  },
  {
    code: 110,
    name: 'Major Depression',
    description: 'Clinical depression disorder',
    category: 'Mental Health'
  },
];

export const PRESCRIPTION_CODES: CodeMapping[] = [
  {
    code: 500,
    name: 'Metformin',
    description: 'Oral diabetes medication (500mg)',
    category: 'Antidiabetic'
  },
  {
    code: 501,
    name: 'Lisinopril',
    description: 'ACE inhibitor for hypertension (10mg)',
    category: 'Antihypertensive'
  },
  {
    code: 502,
    name: 'Albuterol',
    description: 'Bronchodilator inhaler for asthma',
    category: 'Respiratory'
  },
  {
    code: 503,
    name: 'Atorvastatin',
    description: 'Statin for cholesterol management (20mg)',
    category: 'Lipid Lowering'
  },
  {
    code: 504,
    name: 'Amlodipine',
    description: 'Calcium channel blocker (5mg)',
    category: 'Antihypertensive'
  },
  {
    code: 505,
    name: 'Insulin Glargine',
    description: 'Long-acting insulin (100 units/mL)',
    category: 'Antidiabetic'
  },
  {
    code: 506,
    name: 'Levothyroxine',
    description: 'Thyroid hormone replacement (50mcg)',
    category: 'Hormone'
  },
  {
    code: 507,
    name: 'Prednisone',
    description: 'Corticosteroid anti-inflammatory (10mg)',
    category: 'Anti-inflammatory'
  },
  {
    code: 508,
    name: 'Warfarin',
    description: 'Anticoagulant blood thinner (5mg)',
    category: 'Anticoagulant'
  },
  {
    code: 509,
    name: 'Sertraline',
    description: 'SSRI antidepressant (50mg)',
    category: 'Antidepressant'
  },
  {
    code: 510,
    name: 'Ibuprofen',
    description: 'NSAID pain reliever (400mg)',
    category: 'Analgesic'
  },
];

/**
 * Get human-readable name for a condition code
 */
export function getConditionName(code: number): string {
  const condition = CONDITION_CODES.find(c => c.code === code);
  return condition?.name || `Unknown Condition (${code})`;
}

/**
 * Get human-readable name for a prescription code
 */
export function getPrescriptionName(code: number): string {
  const prescription = PRESCRIPTION_CODES.find(p => p.code === code);
  return prescription?.name || `Unknown Medication (${code})`;
}

/**
 * Get full details for a condition code
 */
export function getConditionDetails(code: number): CodeMapping | undefined {
  return CONDITION_CODES.find(c => c.code === code);
}

/**
 * Get full details for a prescription code
 */
export function getPrescriptionDetails(code: number): CodeMapping | undefined {
  return PRESCRIPTION_CODES.find(p => p.code === code);
}
