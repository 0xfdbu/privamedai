import { GeneratedRule } from '../types/claims';

const API_URL = import.meta.env.VITE_XAI_API_URL || 'https://api.x.ai/v1/chat/completions';
const MODEL = import.meta.env.VITE_XAI_MODEL || 'grok-4-1-fast-reasoning';
const API_KEY = import.meta.env.VITE_XAI_API_KEY;

export interface AIResponse {
  rules: GeneratedRule[];
  explanation: string;
  circuitType: 'single' | 'bundled';
}

const SYSTEM_PROMPT = `You are an AI Claim Composer for PrivaMedAI, a privacy-preserving medical credential system using zero-knowledge proofs.

Your task: Convert natural language requests into precise verification rules that can be executed as zero-knowledge proofs.

Available credential fields:
- age (number)
- has_diabetes_diagnosis (boolean)
- vaccinated_last_6_months (boolean)
- vaccination_status (string: complete/partial/none)
- medical_clearance (boolean)
- clearance_expiry (date)
- free_healthcare_eligible (boolean)
- dental_coverage (boolean)
- annual_wellness_exam (string: completed/pending)
- exam_date (date)
- identity_verified (boolean)
- income_eligible (boolean)
- resident_status (string: verified/pending)

Operators: ==, !=, >, <, >=, <=

Response format (JSON only):
{
  "rules": [
    {"field": "age", "operator": ">=", "value": "50", "description": "Age at least 50 years"}
  ],
  "explanation": "Brief explanation of what this proves",
  "circuitType": "single" or "bundled"
}

Rules:
1. Always return valid JSON
2. Use only the fields listed above
3. Make descriptions clear for non-technical users
4. Use bundled circuitType if more than 2 rules
5. Keep explanations under 100 characters`;

export async function parseNaturalLanguage(input: string): Promise<AIResponse> {
  if (!API_KEY || API_KEY === 'your-xai-api-key-here') {
    console.warn('AI API key not configured. Get your key from https://x.ai and set VITE_XAI_API_KEY in .env');
    console.warn('Using fallback parser for now.');
    return fallbackParser(input);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                      content.match(/{[\s\S]*}/);
    
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);

    return {
      rules: parsed.rules || [],
      explanation: parsed.explanation || 'Verification rules generated',
      circuitType: parsed.circuitType || (parsed.rules?.length > 1 ? 'bundled' : 'single'),
    };
  } catch (error) {
    console.error('AI parsing failed, using fallback:', error);
    return fallbackParser(input);
  }
}

function fallbackParser(input: string): AIResponse {
  const lower = input.toLowerCase();
  const rules: GeneratedRule[] = [];
  
  if (lower.includes('diabetes') || lower.includes('clinical trial')) {
    rules.push(
      { field: 'age', operator: '>=', value: '50', description: 'Age at least 50 years' },
      { field: 'has_diabetes_diagnosis', operator: '==', value: 'true', description: 'Has diabetes diagnosis' },
      { field: 'vaccinated_last_6_months', operator: '==', value: 'true', description: 'Vaccinated within last 6 months' },
    );
  } else if (lower.includes('travel') || (lower.includes('vaccinat') && lower.includes('18'))) {
    rules.push(
      { field: 'age', operator: '>=', value: '18', description: 'Age at least 18 years' },
      { field: 'vaccination_status', operator: '==', value: 'complete', description: 'Vaccination complete' },
    );
  } else if (lower.includes('medical clearance') || lower.includes('sports')) {
    rules.push(
      { field: 'medical_clearance', operator: '==', value: 'true', description: 'Medical clearance granted' },
      { field: 'clearance_expiry', operator: '>', value: 'today', description: 'Clearance not expired' },
    );
  } else if (lower.includes('free') || lower.includes('healthcare')) {
    rules.push(
      { field: 'free_healthcare_eligible', operator: '==', value: 'true', description: 'Eligible for free healthcare' },
      { field: 'dental_coverage', operator: '==', value: 'true', description: 'Dental coverage included' },
    );
  } else if (lower.includes('wellness') || lower.includes('annual exam')) {
    rules.push(
      { field: 'annual_wellness_exam', operator: '==', value: 'completed', description: 'Annual wellness exam completed' },
      { field: 'exam_date', operator: '>', value: '1_year_ago', description: 'Exam within last 12 months' },
    );
  } else if (lower.includes('senior') || lower.includes('65') || lower.includes('elderly')) {
    rules.push(
      { field: 'age', operator: '>=', value: '65', description: 'Age 65 or older' },
    );
  } else {
    rules.push(
      { field: 'identity_verified', operator: '==', value: 'true', description: 'Identity verified' },
    );
  }
  
  return {
    rules,
    explanation: `Verification for: ${input.slice(0, 50)}...`,
    circuitType: rules.length > 1 ? 'bundled' : 'single',
  };
}
