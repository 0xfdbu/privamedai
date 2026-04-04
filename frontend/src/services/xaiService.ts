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

Your task: Convert natural language requests into precise verification rules for selective disclosure proofs.

IMPORTANT: Only these selective disclosure circuits are available:
1. verifyForFreeHealthClinic - proves age >= threshold (DEFAULT: use 18 if no specific age mentioned)
2. verifyForPharmacy - proves prescription code match (use prescriptionCode: 500)
3. verifyForHospital - proves age >= threshold AND condition code match (DEFAULT: use 18 and conditionCode: 100)

Available credential fields for selective disclosure:
- age (number) - used with >= operator. DEFAULT TO 18 unless user specifies a different age (like "over 65")
- conditionCode (number) - medical condition identifier (default: 100)
- prescriptionCode (number) - prescription identifier (default: 500)

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
    throw new Error('AI API key not configured. Please set VITE_XAI_API_KEY in your .env file. Get your key from https://x.ai');
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
    console.error('AI parsing failed:', error);
    throw error;
  }
}

