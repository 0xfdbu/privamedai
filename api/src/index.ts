import express from 'express'
import cors from 'cors'
import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import type { CredentialRequest, CredentialResponse, IssuanceRecord } from './types.js'

const app = express()
app.use(cors())
app.use(express.json())

// Generate a persistent issuer keypair (in-memory for demo)
const issuerKeypair = nacl.sign.keyPair()
const issuerPublicKey = Buffer.from(issuerKeypair.publicKey).toString('hex')

// In-memory store for demo
const issuanceRecords: IssuanceRecord[] = []

function hashCredential(data: object): string {
  const str = JSON.stringify(data)
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  // Simple hash using tweetnacl hash (SHA-512, truncated to 32 bytes for demo)
  const hash = nacl.hash(bytes)
  return Buffer.from(hash.slice(0, 32)).toString('hex')
}

app.post('/api/issue', (req, res) => {
  try {
    const body = req.body as CredentialRequest
    const expiry = Date.now() + body.expiryDays * 24 * 60 * 60 * 1000

    const rawData = {
      subject: body.subject,
      claimType: body.claimType,
      claimValue: body.claimValue,
      expiry,
      issuedAt: Date.now(),
    }

    const claimHash = hashCredential(rawData)
    const commitment = hashCredential({ claimHash, issuer: issuerPublicKey, salt: nacl.randomBytes(16) })

    const message = Buffer.from(commitment, 'hex')
    const signature = Buffer.from(nacl.sign.detached(message, issuerKeypair.secretKey)).toString('hex')

    const record: IssuanceRecord = {
      commitment,
      subject: body.subject,
      claimType: body.claimType,
      claimValue: body.claimValue,
      expiry,
      issuedAt: Date.now(),
    }
    issuanceRecords.push(record)

    const response: CredentialResponse = {
      success: true,
      commitment,
      issuer: issuerPublicKey,
      claimHash,
      expiry,
      signature,
    }

    res.json(response)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message } as CredentialResponse)
  }
})

app.get('/api/issuer', (_req, res) => {
  res.json({ publicKey: issuerPublicKey })
})

app.get('/api/records', (_req, res) => {
  res.json(issuanceRecords)
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`PrivaCred issuer API running on http://localhost:${PORT}`)
  console.log(`Issuer public key: ${issuerPublicKey}`)
})
