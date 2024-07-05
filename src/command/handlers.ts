
import * as net from "net";
import { respSimpleString, respBulkString, respNull, encodeArray } from "../helpers/encoding";
import { kvStore } from "../../store/kvStore";
import { config } from "../config";
import { RedisCommands } from ".";


export const handleSetCommand = (commands: string[], connection: net.Socket) => {
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

export const handleGetCommand = (commands: string[], connection: net.Socket) => {
  const key = commands[1];
  const entry = kvStore[key];
  const now = new Date();

  if (!entry || (entry.expiration && entry.expiration < now)) {
    connection.write(respNull);
  } else {
    connection.write(respBulkString(entry.value));
  }
};

export const handleInfoCommand = (commands: string[], connection: net.Socket) => {
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

export const handlePSyncCommand = (connection: net.Socket) => {
  connection.write(respSimpleString(`FULLRESYNC ${config.masterReplicationId} 0`));

  const emptyRDB = Buffer.from(
    "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==",
    "base64"
  );
  connection.write(`$${emptyRDB.length}\r\n`);
  connection.write(emptyRDB);

  config.replicas.push({ connection, offset: 0, active: true });
};

const propagateToReplicas = (commands: string[]) => {
  config.replicas = config.replicas.filter((r) => r.active);
  for (const replica of config.replicas) {
    const data = encodeArray(commands);
    replica.connection.write(data);
    replica.offset += data.length;
  }
};