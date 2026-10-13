export const getRecordedPhone = (value?: string): string | undefined => {
  const phone = value?.trim();
  if (!phone || /^(unknown|n\/?a|null|undefined|not recorded)$/i.test(phone)) return undefined;
  const digits = phone.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0))).replace(/\D/g, '');
  return digits && /[1-9]/.test(digits) ? phone : undefined;
};
