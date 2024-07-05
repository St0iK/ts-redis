export const commandParser = (input: Buffer): string[] => {
  const parts = input.toString().split("\r\n");
  const commands: string[] = [];

  if (parts[0].startsWith("+FULLRESYNC") || parts[0].startsWith("$")) {
    return commands;
  }

  let index = 0;
  while (index < parts.length) {
    if (parts[index] === "") break;

    if (!parts[index].startsWith("*")) throw new Error("Expected RESP array");

    const arrSize = parseInt(parts[index++].substring(1), 10);

    for (let i = 0; i < arrSize; i++) {
      if (!parts[index].startsWith("$")) throw new Error("Expected RESP bulk string");

      const strSize = parseInt(parts[index++].substring(1), 10);
      const string = parts[index++];

      if (string.length !== strSize) throw new Error("Bulk string size mismatch");

      commands.push(string);
    }
  }
  return commands;
};
