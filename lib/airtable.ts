import Airtable from 'airtable'

export const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN! })
  .base(process.env.AIRTABLE_BASE_ID!)

// Escape value for use inside double-quoted Airtable formula strings
export const esc = (v: unknown): string =>
  String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
