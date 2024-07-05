import * as net from "net";

// Logging
console.log("Redis server booted... 🚀");

// Type Definitions
type RedisInstanceConfig = {
  port: number;
  role: string;
  masterReplicationId?: string;
  masterReplicationOffset?: number;
  master?: MasterConfig;
  replicas: ReplicaState[];
};

type MasterConfig = {
  host: string;
  port: number;
};

type ReplicaState = {
  connection: net.Socket;
  offset: number;
  active: boolean;
};

type KeyValueStore = {
  [key: string]: {
    expiration?: Date;
    value: string;
  };
};

// Constants
const RedisCommands = {
  PING: "PING",
  ECHO: "ECHO",
  SET: "SET",
  GET: "GET",
  PX: "PX",
  INFO: "INFO",
  REPLCONF: "REPLCONF",
  PSYNC: "PSYNC",
} as const;

// Initial Configuration
const config: RedisInstanceConfig = {
  port: 6379,
  role: "master",
  masterReplicationId: generateReplID(),
  masterReplicationOffset: 0,
  replicas: [],
};

const kvStore: KeyValueStore = {};

// Helper Functions
function generateReplID(): string {
  const charSet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 40 }, () => charSet[Math.floor(Math.random() * charSet.length)]).join("");
};

const respSimpleString = (data: string): string => `+${data}\r\n`;
const respBulkString = (data: string): string => `$${data.length}\r\n${data}\r\n`;
const respNull = `$-1\r\n`;

const encodeBulk = (s: string): string => s.length === 0 ? respNull : `\$${s.length}\r\n${s}\r\n`;
const encodeArray = (arr: string[]): string => arr.reduce((result, s) => result + `\$${s.length}\r\n${s}\r\n`, `*${arr.length}\r\n`);

// Command Handling
const commandHandler = (commands: string[], connection: net.Socket) => {
  const command = commands[0]?.toUpperCase();

  switch (command) {
    case RedisCommands.PING:
      connection.write(respSimpleString("PONG"));
      break;

    case RedisCommands.ECHO:
      connection.write(respSimpleString(commands[1]));
      break;

    case RedisCommands.SET:
      handleSetCommand(commands, connection);
      break;

    case RedisCommands.GET:
      handleGetCommand(commands, connection);
      break;

    case RedisCommands.INFO:
      handleInfoCommand(commands, connection);
      break;

    case RedisCommands.REPLCONF:
      connection.write(respSimpleString("OK"));
      break;

    case RedisCommands.PSYNC:
      handlePSyncCommand(connection);
      break;

    default:
      connection.write(respNull);
  }
};

const handleSetCommand = (commands: string[], connection: net.Socket) => {
  const key = commands[1];
  kvStore[key] = { value: commands[2] };

  if (commands.length > 3 && commands[3].toUpperCase() === RedisCommands.PX) {
    const durationInMs = parseInt(commands[4], 10);
    const date = new Date();
    date.setMilliseconds(date.getMilliseconds() + durationInMs);
    kvStore[key].expiration = date;
  }

  if (config.role === "master") {
    connection.write(respSimpleString("OK"));
    propagateToReplicas(commands);
  }
};

const handleGetCommand = (commands: string[], connection: net.Socket) => {
  const key = commands[1];
  const entry = kvStore[key];
  const now = new Date();

  if (!entry || (entry.expiration && entry.expiration < now)) {
    connection.write(respNull);
  } else {
    connection.write(respBulkString(entry.value));
  }
};

const handleInfoCommand = (commands: string[], connection: net.Socket) => {
  if (commands[1] === "replication") {
    connection.write(
      encodeBulk(
        `role:${config.role}\r\nmaster_replid:${config.masterReplicationId}\r\nmaster_repl_offset:${config.masterReplicationOffset}`
      )
    );
  } else {
    connection.write(respNull);
  }
};

const handlePSyncCommand = (connection: net.Socket) => {
  connection.write(respSimpleString(`FULLRESYNC ${config.masterReplicationId} 0`));

  const emptyRDB = Buffer.from(
    "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==",
    "base64"
  );
  connection.write(`\$${emptyRDB.length}\r\n`);
  connection.write(emptyRDB);

  config.replicas.push({ connection, offset: 0, active: true });
};



// Command Parser
const commandParser = (input: Buffer): string[] => {
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

// Replica Handshake
const replicaHandshake = (config: RedisInstanceConfig): void => {
  if (!config.master) return;

  const connection = net.connect(config.master.port, config.master.host);
  connection.write(encodeArray(["PING"]));

  let stage = 0;
  const onData = (input: Buffer) => {
    if (stage === 0) {
      connection.write(encodeArray(["REPLCONF", "listening-port", config.port.toString()]));
      stage = 1;
    } else if (stage === 1) {
      connection.write(encodeArray(["REPLCONF", "capa", "eof", "capa", "psync2"]));
      stage = 2;
    } else if (stage === 2) {
      connection.write(encodeArray(["PSYNC", "?", "-1"]));
      connection.removeListener("data", onData);
      connection.on("data", (input: Buffer) => {
        const commands = commandParser(input);
        commandHandler(commands, connection);
      });
    }
  };
  connection.addListener("data", onData);
};

// Server Setup
const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.on("data", (input: Buffer) => {
    const commands = commandParser(input);
    commandHandler(commands, connection);
  });

  connection.on("end", () => {
    console.log("Client disconnected");
  });
});

server.listen(config.port, "127.0.0.1");

// Command Line Arguments Handling
for (let i = 0; i < process.argv.length; i++) {
  const element = process.argv[i];
  switch (element) {
    case "--port":
      config.port = Number(process.argv[i + 1]);
      break;
    case "--replicaof":
      const [masterHost, masterPort] = process.argv[i + 1].split(" ");
      config.role = "slave";
      config.master = { host: masterHost, port: Number(masterPort) };
      break;
    default:
      break;
  }
}

// Initiate Replica Handshake if needed
if (config.role === "slave") {
  replicaHandshake(config);
}
