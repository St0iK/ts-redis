import * as net from "net";

console.log("Redis server booted... 🚀");

type redisInstanceConfig = {
  port: number
  role: string
  masterReplicationId?: string
  masterReplicationOffset?: number
  master?: {
    host: string
    port: number
  }
  replicas: replicaState[]
}

const config: redisInstanceConfig = {
  port: 6379,
  role: "master",
  masterReplicationId: generateReplID(),
  masterReplicationOffset: 0,
  replicas: []
}

type replicaState = {
  connection: net.Socket;
  offset: number;
  active: boolean;
};

for (let i = 0; i < Bun.argv.length; i++) {
  const element = Bun.argv[i];
  switch (element) {
    case "--port":
      config.port = Number(Bun.argv[i + 1])
      break;
    case "--replicaof":
      const [masterHost, masterPort] = Bun.argv[i + 1].split(" ");
      config.role = "slave"
      config.master = {
        host: masterHost,
        port: Number(masterPort)
      }
      break;

    default:
      break;
  }
}

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

type keyValueStore = {
  [key: string]: {
    expiration?: Date;
    value: string;
  };
};
const kvStore: keyValueStore = {};

replicaHandshake(config);
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
  const command = commands[0]?.toUpperCase();

  if (command === RedisCommands.PING) {
    connection.write(respSimpleString("PONG"));
  }

  if (command === RedisCommands.ECHO) {
    connection.write(respSimpleString(commands[1]));
  }

  if (command === RedisCommands.SET) {
    console.log(config);
    console.log("called!");
    const key = commands[1];
    kvStore[key] = { value: commands[2] }
    console.log({ kvStore });
    if (commands.length > 3 && commands[3].toUpperCase() === RedisCommands.PX) {
      const durationInMs = parseInt(commands[4], 10);
      const date = new Date();
      date.setMilliseconds(date.getMilliseconds() + durationInMs);
      kvStore[key].expiration = date;

    }
    if (config.role === "master") {
      connection.write(respSimpleString("OK"));
      console.log("propagateToReplicas");
      propagateToReplicas(commands)
    }

  }

  if (command === RedisCommands.GET) {
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

  if (command === RedisCommands.INFO) {
    if (commands[1] === "replication") {
      connection.write(
        encodeBulk(
          `role:${config.role}\r\nmaster_replid:${config.masterReplicationId}\r\nmaster_repl_offset:${config.masterReplicationOffset}`,
        ),
      );
      return;
    }
    connection.write(respNull);
    return;
  }

  if (command === RedisCommands.REPLCONF) {
    connection.write(
      respSimpleString("OK"),
    );
    return;
  }

  if (command === RedisCommands.PSYNC) {
    connection.write(
      respSimpleString(`FULLRESYNC ${config.masterReplicationId} 0`),
    );

    const emptyRDB = Buffer.from(
      "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==",
      "base64",
    );
    connection.write(`\$${emptyRDB.length}\r\n`);
    connection.write(emptyRDB);

    config.replicas.push({ connection, offset: 0, active: true });
    return;
  }
}

const commandParser = (input: Buffer): string[] => {
  const inputString = input.toString();
  const parts = inputString.split("\r\n");
  const commands: string[] = [];

  if (parts[0].startsWith("+FULLRESYNC")) {
    return commands;
  }

  if (parts[0].startsWith("$")) {
    return commands;
  }

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
  console.log({ commands });
  return commands;
}

function replicaHandshake(config: redisInstanceConfig): void {
  if (!config.master) {
    return;
  }
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

  }
  connection.addListener("data", onData);

}

const respSimpleString = (data: string) => `+${data}\r\n`
const respBulkString = (data: string) => `$${data.length}\r\n${data}\r\n`
const respNull = `$-1\r\n`;
const encodeBulk = (s: string): string => {
  if (s.length === 0) {
    return respNull;
  }
  return `\$${s.length}\r\n${s}\r\n`;
}
function encodeArray(arr: string[]): string {
  let result = `*${arr.length}\r\n`;
  for (const s of arr) {
    result += `\$${s.length}\r\n${s}\r\n`;
  }
  return result;
}

function generateReplID() {
  const charSet = 'abcdefghijlkmnopqrstuvwxyz0123456789';
  const result = [];
  for (let i = 0; i < 40; i++) {
    const digitIndex = Math.floor(Math.random() * charSet.length);
    result.push(charSet[digitIndex]);
  }
  return result.join("");
}

function propagateToReplicas(commands: string[]) {
  config.replicas = config.replicas.filter((r) => r.active);
  // console.log(config.replicas);
  for (const replica of config.replicas) {
    const data = encodeArray(commands)
    replica.connection.write(data);
    replica.offset += data.length;
  }
}

server.listen(config.port, "127.0.0.1");
