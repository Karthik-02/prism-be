import { randomInt } from "node:crypto";

export const generateNumericOtp = (length: number): string => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
};
