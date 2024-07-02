import * as net from "net";

console.log("Redis server booted... 🚀");

const RedisCommands = {
  ECHO: "ECHO",
  SET: "SET",
  GET: "GET",
  PX: "PX",
} as const;

const RedisSet = new Map();
const server: net.Server = net.createServer((connection: net.Socket) => {

  connection.on("data", (input: Buffer) => {
    const commands = commandParser(input);
    commandHandler(commands, connection);
  });

  connection.on("end", () => {
    console.log("Client disconnected");
  });

});

const commandHandler = (commands: string[], connection: net.Socket) => {
  const command = commands[0];

  if(command.toUpperCase() === RedisCommands.ECHO) {
    connection.write(respSimpleString(commands[1]));
  }

  if(command.toUpperCase() === RedisCommands.SET) {
    const key = commands[1];
    RedisSet.set(key,commands[2]);
    if(commands.length > 3 && commands[3].toUpperCase() === RedisCommands.PX){
      const expiry = +commands[4];
      console.log({expiry});
      setTimeout(() => RedisSet.delete(key),expiry);
    }
    connection.write(respSimpleString("OK"));
  }

  if(command.toUpperCase() === RedisCommands.GET) {
    console.log(commands[1]);
    const value = RedisSet.get(commands[1]);
    console.log({value});
    if(!value) {
      connection.write(respNull);  
    }
    connection.write(respBulkString(value));
  }

} 

const commandParser = (input: Buffer): string[] => {
  const inputString = input.toString();
  console.log(inputString)
  const parts = inputString.split("\r\n");
  const commands = [];
  
  let index = 0;
  while (index < parts.length) {
    if (parts[index] === "") {
        break;
    }
    
    if (!parts[index].startsWith("*")) {
        throw new Error("Expected RESP array");
    }
    
    const arrSize = parseInt(parts[index++].substring(1), 10);
    
    for (let i = 0; i < arrSize; i++) {
        if (!parts[index].startsWith("$")) {
            throw new Error("Expected RESP bulk string");
        }
        
        const strSize = parseInt(parts[index++].substring(1), 10);
        const string = parts[index++];
        
        if (string.length !== strSize) {
            throw new Error("Bulk string size mismatch");
        }
        
        commands.push(string);
    }
  }
  console.log({commands});
  return commands;
}


const respSimpleString = (data: string) => `+${data}\r\n`
const respBulkString = (data: string) => `$${data.length}\r\n${data}\r\n`
const respNull = `$-1\r\n`;

server.listen(6379, "127.0.0.1");
