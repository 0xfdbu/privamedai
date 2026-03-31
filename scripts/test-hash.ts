import { createHash } from 'crypto';

const secretKey = Buffer.from('47,116,66,231,13,98,157,217,85,233,183,149,177,248,30,248,203,78,14,150,4,77,160,146,201,249,16,1,221,120,80,209'.split(',').map(Number));
const prefix = Buffer.from('privamed:pk:');

console.log('Secret key:', secretKey.toString('hex'));
console.log('Prefix:', prefix.toString('hex'));

// Try different hash approaches
// Approach 1: Direct concat and SHA-256
const hash1 = createHash('sha256').update(Buffer.concat([prefix, secretKey])).digest('hex');
console.log('\n1. SHA-256(prefix || secret):', hash1);

// Approach 2: Pad prefix to 32 bytes and hash
const prefix32 = Buffer.alloc(32);
prefix.copy(prefix32);
const hash2 = createHash('sha256').update(Buffer.concat([prefix32, secretKey])).digest('hex');
console.log('2. SHA-256(pad(prefix,32) || secret):', hash2);

// Approach 3: Double SHA-256 (like Bitcoin)
const hash3 = createHash('sha256').update(createHash('sha256').update(Buffer.concat([prefix32, secretKey])).digest()).digest('hex');
console.log('3. Double SHA-256:', hash3);

// Approach 4: Hash of vector [prefix, secret] with length prefix
const vecLen = Buffer.alloc(4);
vecLen.writeUInt32BE(2, 0); // Vector of 2 elements
const hash4 = createHash('sha256').update(Buffer.concat([vecLen, prefix32, secretKey])).digest('hex');
console.log('4. SHA-256 with vector length:', hash4);

// The actual admin key stored (from previous test with coin public key)
console.log('\nWallet coin public key:');
console.log('5fee55f4ab44e3674ba6cbcc50c24152758cd2fb675ea8820cd04852f596d45a');
