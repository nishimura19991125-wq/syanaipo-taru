// Deterministic color assignment for calendar members
const MEMBER_COLORS = [
  '#0B8043', // Google green
  '#E67C73', // Google red
  '#F4511E', // Google orange
  '#F6BF26', // Google yellow
  '#33B679', // Google teal
  '#039BE5', // Google light blue
  '#7986CB', // Google lavender
  '#8D6E63', // Google graphite
  '#616161', // Google sage
  '#D50000', // Google tomato
]

// Generate a consistent color for a user based on their ID
export function getMemberColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

// Lighten a hex color for backgrounds
export function lightenColor(hex: string, amount = 0.85): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.round((255 - (num >> 16)) * amount + (num >> 16))
  const g = Math.round((255 - ((num >> 8) & 0xff)) * amount + ((num >> 8) & 0xff))
  const b = Math.round((255 - (num & 0xff)) * amount + (num & 0xff))
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
