import * as net from "net";

console.log("Redis server booted... 🚀");

type RedisConfig = {
  port: number
  role: string
  master?: {
    host: string
    port: number
  }
}

const RedisConfig: RedisConfig = {
  port: 6379,
  role: "master"
}

for (let i = 0; i < Bun.argv.length; i++) {
  const element = Bun.argv[i];
  switch (element) {
    case "--port":
      RedisConfig.port = Number(Bun.argv[i + 1])
      break;
    case "--replicaof":
      const [masterHost, masterPort] = Bun.argv[i + 1].split(" ");
      RedisConfig.role = "slave"
      RedisConfig.master = {
        host: masterHost,
        port: Number(masterPort)
      }
      break;
  
    default:
      break;
  }
}
 
const RedisCommands = {
  ECHO: "ECHO",
  SET: "SET",
  GET: "GET",
  PX: "PX",
  INFO: "INFO",
} as const;

type keyValueStore = {
  [key: string]: {
    expiration?: Date;
    value: string;
  };
};
const kvStore: keyValueStore = {};
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
  const command = commands[0].toUpperCase();

  if(command === RedisCommands.ECHO) {
    connection.write(respSimpleString(commands[1]));
  }

  if(command === RedisCommands.SET) {
    const key = commands[1];
    kvStore[key] = { value:commands[2] }
    
    if(commands.length > 3 && commands[3].toUpperCase() === RedisCommands.PX){
      const durationInMs = parseInt(commands[4], 10);
      const date = new Date();
      date.setMilliseconds(date.getMilliseconds() + durationInMs);
      kvStore[key].expiration = date;
      
    }
    connection.write(respSimpleString("OK"));
  }

  if(command === RedisCommands.GET) {
    if (!Object.hasOwn(kvStore, commands[1])) {
      connection.write(respNull);
      return;
    }
    const entry = kvStore[commands[1]];
    const now = new Date();
    if ((entry.expiration ?? now) < now) {
      delete kvStore[commands[1]];
      connection.write(respNull);
      return;
    }
    
    connection.write(respBulkString(entry.value));
  }

  if(command === RedisCommands.INFO) {
    if(commands[1] === "replication") {
      connection.write(respBulkString(`role:${RedisConfig.role}`));
      return;
    }
    connection.write(respNull);
    return;
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

server.listen(RedisConfig.port, "127.0.0.1");
