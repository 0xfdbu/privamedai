export interface CredentialRequest {
  subject: string
  claimType: string
  claimValue: string
  expiryDays: number
}

export interface CredentialResponse {
  success: boolean
  commitment: string
  issuer: string
  claimHash: string
  expiry: number
  signature: string
  error?: string
}

export interface IssuanceRecord {
  commitment: string
  subject: string
  claimType: string
  claimValue: string
  expiry: number
  issuedAt: number
}
