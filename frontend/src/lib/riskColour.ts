export function riskColour(score: number): { text: string; bg: string; ring: string } {
  if (score <= 30) {
    return { text: 'text-green-700', bg: 'bg-green-100', ring: 'ring-green-200' };
  }
  if (score <= 60) {
    return { text: 'text-yellow-700', bg: 'bg-yellow-100', ring: 'ring-yellow-200' };
  }
  if (score <= 80) {
    return { text: 'text-orange-700', bg: 'bg-orange-100', ring: 'ring-orange-200' };
  }
  return { text: 'text-red-700', bg: 'bg-red-100', ring: 'ring-red-200' };
}
