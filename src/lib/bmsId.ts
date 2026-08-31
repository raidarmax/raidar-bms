export function generateBMSId(count: number): string {
  const year = new Date().getFullYear();
  const sequenceNumber = String(count + 1).padStart(5, '0');
  return `BMS-${year}-${sequenceNumber}`;
}
