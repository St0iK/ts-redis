export const generateReplID = (): string => {
  const chars = "0123456789abcdef";
  let replID = "";
  for (let i = 0; i < 40; i++) {
    replID += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return replID;
};
