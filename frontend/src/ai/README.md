# AI Claim Composer - Production Architecture

## Current State: Pattern Matching (MVP)
The current implementation uses simple pattern matching with hardcoded presets. This is NOT production AI - it's a demo/prototype.

```typescript
// Current (mock)
if (input.includes('diabetes')) return PRESET_CLAIMS.diabetes_trial;
```

## Production Options (Ranked by Privacy)

### 1. Local LLM via Transformers.js ⭐⭐⭐⭐⭐
**Best for Privacy - Zero Data Leakage**

**Stack:**
- `@xenova/transformers` - Browser ML inference
- Quantized model (4-bit, ~500MB-2GB)
- WebGPU acceleration

**Code Example:**
```typescript
import { pipeline } from '@xenova/transformers';

// Download model once, cache in IndexedDB
const parser = await pipeline(
  'text2text-generation',
  'midnight/compact-claim-parser-q4',
  { dtype: 'q4', device: 'webgpu' }
);

const parseClaim = async (input: string) => {
  const result = await parser(input, { 
    max_length: 256,
    temperature: 0.1 
  });
  return JSON.parse(result[0].generated_text);
};
```

**Pros:**
- ✅ 100% private - no network calls
- ✅ Works offline (air-gapped clinics)
- ✅ HIPAA/GDPR compliant by design
- ✅ No API costs

**Cons:**
- ❌ Large initial download
- ❌ Requires modern hardware (WebGPU)
- ❌ Slower inference (2-5s)

---

### 2. Zero-Knowledge Cloud AI (zkML) ⭐⭐⭐⭐
**Best for Powerful Models + Privacy**

User encrypts query → Cloud AI processes encrypted data → Returns ZK proof

**Pros:**
- ✅ Can use GPT-4 level models
- ✅ AI provider can't see data
- ✅ Mathematically verifiable

**Cons:**
- ❌ Complex implementation
- ❌ Slower (10-30s)
- ❌ Cutting-edge (limited tooling)

---

### 3. HIPAA-Compliant Cloud AI ⭐⭐⭐
**Best for Production Speed**

**Stack:**
- Azure OpenAI with HIPAA BAA
- AWS Bedrock healthcare
- End-to-end encryption

**Pros:**
- ✅ Production-ready today
- ✅ Fast inference
- ✅ Best model quality

**Cons:**
- ❌ Data leaves device
- ❌ Requires trust
- ❌ Ongoing costs
- ❌ Regulatory complexity

---

## Recommended Launch Strategy

### Phase 1: Pattern Matching (NOW)
```typescript
// Expand presets to cover 80% of common cases
const PRESET_CLAIMS = {
  'diabetes_trial': {...},
  'insurance_coverage': {...},
  'age_verification': {...},
  'medical_license': {...},
  'vaccination_status': {...},
  'prescription_authority': {...},
  // ... 50+ presets
};
```

### Phase 2: Local Small LLM (3 months)
```typescript
// Load model on-demand
const loadModel = async () => {
  const model = await fetch('/models/compact-parser-q4.onnx');
  // Cache in IndexedDB
};
```

### Phase 3: Hybrid (6 months)
```typescript
const parseClaim = async (input: string) => {
  // 1. Try patterns (instant)
  const preset = checkPresets(input);
  if (preset) return preset;
  
  // 2. Try local model (private)
  const local = await localModel.parse(input);
  if (local.confidence > 0.8) return local;
  
  // 3. Ask user for cloud consent
  if (await userConsents()) {
    return await cloudAI.parse(encrypt(input));
  }
  
  // 4. Manual rule builder
  return manualBuilder.open(input);
};
```

---

## Privacy Checklist

- [ ] **Data Minimization**: Never send PHI to AI
- [ ] **Local First**: Process client-side when possible
- [ ] **Encryption**: E2E encryption for cloud
- [ ] **Consent**: Explicit opt-in for cloud processing
- [ ] **No Logging**: Local-only audit trails
- [ ] **Right to Delete**: Easy data removal

---

## Healthcare Compliance

| Regulation | Requirement | Solution |
|------------|-------------|----------|
| HIPAA | PHI protection | Local processing |
| HIPAA | BAA for cloud | Azure/AWS healthcare |
| GDPR | Privacy by design | Local-first architecture |
| GDPR | Right to explanation | Show generated rules |
| 21 CFR Part 11 | Audit trails | Local immutable logs |

---

## Bottom Line

**For Production Launch:**
1. **Expand pattern matching** to 50+ common claim types
2. **Add manual rule builder** for edge cases
3. **Label as "AI-Assisted"** not "AI-Powered" until real model
4. **Promise privacy**: "Your health data never leaves your device"

**For Real AI:**
- Local LLM (transformers.js) = Best privacy
- Cloud with consent = Best performance
- Hybrid = Best balance
