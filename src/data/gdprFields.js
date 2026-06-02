export const GDPR_FIELDS = [
  {
    field: "data.classification",
    type: "string",
    operators: ["equals", "is one of"],
    presetValues: ["PII", "PHI", "PCI", "Sensitive", "Internal", "Public"],
    gdprArticle: "Article 4(1)",
    icon: "\uD83C\uDFF7\uFE0F",
    category: "Data Classification"
  },
  {
    field: "data.subject.rights",
    type: "string",
    operators: ["equals"],
    presetValues: ["access", "rectification", "erasure", "restrict_processing", "data_portability", "object"],
    gdprArticle: "Articles 15-21",
    icon: "\uD83D\uDC64",
    category: "Data Subject Rights"
  },
  {
    field: "data.legal_basis",
    type: "string",
    operators: ["equals", "is one of"],
    presetValues: ["consent", "contract", "legal_obligation", "vital_interests", "public_interest", "legitimate_interest"],
    gdprArticle: "Article 6",
    icon: "\u2696\uFE0F",
    category: "Lawful Basis"
  },
  {
    field: "data.transfer.country",
    type: "string",
    operators: ["equals", "is one of", "is not one of"],
    presetValues: ["DE", "FR", "IT", "ES", "NL", "US", "IN", "CN", "RU", "BR"],
    gdprArticle: "Articles 44-49",
    icon: "\uD83C\uDF0D",
    category: "Cross-Border Transfer"
  },
  {
    field: "data.breach.type",
    type: "string",
    operators: ["equals", "is one of"],
    presetValues: ["confidentiality", "integrity", "availability", "unauthorized_access", "data_loss", "ransomware"],
    gdprArticle: "Articles 33-34",
    icon: "\uD83D\uDD34",
    category: "Data Breach"
  },
  {
    field: "data.breach.notification_deadline",
    type: "number",
    operators: ["lt", "lte", "gt", "gte"],
    presetValues: ["24", "48", "72"],
    gdprArticle: "Article 33",
    icon: "\u23F0",
    category: "Breach Notification"
  },
  {
    field: "data.retention.period",
    type: "number",
    operators: ["gt", "gte", "lt", "lte"],
    presetValues: ["30", "90", "180", "365", "730", "1825"],
    gdprArticle: "Article 5(1)(e)",
    icon: "\uD83D\uDCE6",
    category: "Storage Limitation"
  },
  {
    field: "data.encryption.status",
    type: "string",
    operators: ["equals", "is one of"],
    presetValues: ["encrypted", "unencrypted", "at_rest", "in_transit", "end_to_end"],
    gdprArticle: "Article 32(1)(a)",
    icon: "\uD83D\uDD10",
    category: "Security Measures"
  },
  {
    field: "data.consent.status",
    type: "string",
    operators: ["equals", "is one of"],
    presetValues: ["given", "withdrawn", "expired", "never_given", "invalid"],
    gdprArticle: "Article 7",
    icon: "\u2705",
    category: "Consent Management"
  },
  {
    field: "data.dpia.required",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Article 35",
    icon: "\uD83D\uDCCB",
    category: "DPIA"
  },
  {
    field: "data.pseudonymization",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Article 4(5)",
    icon: "\uD83C\uDFAD",
    category: "Pseudonymization"
  },
  {
    field: "data.processing.purpose",
    type: "string",
    operators: ["equals", "is one of", "contains"],
    presetValues: ["marketing", "analytics", "security", "legal", "hr", "finance", "healthcare"],
    gdprArticle: "Article 5(1)(b)",
    icon: "\uD83C\uDFAF",
    category: "Purpose Limitation"
  },
  {
    field: "data.access.request_id",
    type: "string",
    operators: ["equals", "exists", "does not exist"],
    presetValues: [],
    gdprArticle: "Article 15",
    icon: "\uD83D\uDD0D",
    category: "Access Request"
  },
  {
    field: "data.dpo.alert",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Articles 37-39",
    icon: "\uD83D\uDC54",
    category: "DPO Notification"
  },
  {
    field: "data.third_party.processor",
    type: "string",
    operators: ["equals", "is one of", "contains"],
    presetValues: ["aws", "azure", "gcp", "salesforce", "workday", "sap"],
    gdprArticle: "Article 28",
    icon: "\uD83E\uDD1D",
    category: "Third Party"
  },
  {
    field: "data.minimization.check",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Article 5(1)(c)",
    icon: "\u2702\uFE0F",
    category: "Data Minimization"
  },
  {
    field: "data.accuracy.verified",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Article 5(1)(d)",
    icon: "\u2714\uFE0F",
    category: "Accuracy"
  },
  {
    field: "data.logging.enabled",
    type: "boolean",
    operators: ["is"],
    presetValues: ["true", "false"],
    gdprArticle: "Article 30",
    icon: "\uD83D\uDCDD",
    category: "Record Keeping"
  }
]

export const GDPR_CATEGORIES = [...new Set(GDPR_FIELDS.map(f => f.category))]

export function getGdprField(fieldName) {
  return GDPR_FIELDS.find(f => f.field === fieldName) || null
}
