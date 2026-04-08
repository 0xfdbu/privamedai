import { GeneratedRule } from '../types/claims';

const STORAGE_KEY = 'privamed-ai-settings';

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'minimax/minimax-m2.5:free',
};

function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load AI settings:', e);
  }
  return DEFAULT_SETTINGS;
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

export interface AIResponse {
  rules: GeneratedRule[];
  explanation: string;
  circuitType: 'single' | 'bundled';
}

export async function parseNaturalLanguage(input: string): Promise<AIResponse> {
  const settings = getSettings();
  const { apiKey, model } = settings;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'AI API key not configured. Click the ⚙️ icon in the AI chat to set up your OpenRouter API key.'
    );
  }

  if (!model || model.trim() === '') {
    throw new Error('Please configure a model in the AI settings.');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'PrivaMedAI',
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.message?.text ?? '';
    
    if (!content || typeof content !== 'string') {
      console.log('No content in response, full data:', data);
      throw new Error('Empty response from AI');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                      content.match(/{[\s\S]*}/);
    
    let parsed: any;
    try {
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse JSON from response:', content);
      throw new Error('AI response was not valid JSON');
    }

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

export function hasApiKeyConfigured(): boolean {
  const settings = getSettings();
  return settings.apiKey.trim().length > 0;
}