export const respSimpleString = (message: string): string => `+${message}\\r\\n`;
export const respBulkString = (message: string): string => `$${message.length}\\r\\n${message}\\r\\n`;
export const respNull = "$-1\\r\\n";

export const encodeArray = (array: string[]): string => {
  let result = `*${array.length}\\r\\n`;
  array.forEach(item => {
    result += `$${item.length}\\r\\n${item}\\r\\n`;
  });
  return result;
};

export const encodeBulk = (message: string): string => {
  if (message.length === 0) return respNull;
  return `$${message.length}\\r\\n${message}\\r\\n`;
};