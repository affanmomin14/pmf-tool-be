export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 500);
};
