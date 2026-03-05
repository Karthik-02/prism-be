const MASK_CHAR = "*";

export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return MASK_CHAR.repeat(6);
  }

  const visibleChars = Math.min(localPart.length, 2);
  const maskedLocalPart = `${localPart.slice(0, visibleChars)}${MASK_CHAR.repeat(Math.max(localPart.length - visibleChars, 2))}`;

  return `${maskedLocalPart}@${domain}`;
};
