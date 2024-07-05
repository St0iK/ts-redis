import * as net from "net";
import { respSimpleString, respNull } from "../helpers/encoding";
import { handleGetCommand, handleInfoCommand, handlePSyncCommand, handleSetCommand } from "./handlers";

export const RedisCommands = {
  PING: "PING",
  ECHO: "ECHO",
  SET: "SET",
  GET: "GET",
  PX: "PX",
  INFO: "INFO",
  REPLCONF: "REPLCONF",
  PSYNC: "PSYNC",
} as const;


export const commandHandler = (commands: string[], connection: net.Socket) => {
  const command = commands[0]?.toUpperCase();
  console.log({ command });
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
