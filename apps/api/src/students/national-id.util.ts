/**
 * F-02: default validator is the Israeli national ID checksum (9 digits,
 * last digit is a Luhn-style check digit). "Configurable per country" is
 * explicitly deferred in the PRD — this is the only validator needed now.
 */
export function isValidIsraeliNationalId(rawId: string): boolean {
  const cleaned = rawId.replace(/\D/g, "");
  if (cleaned.length === 0 || cleaned.length > 9) return false;

  const padded = cleaned.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(padded[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}
