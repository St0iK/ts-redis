import * as net from "net";
import { RedisCommands } from "./commands";
import { respSimpleString, respBulkString, respNull } from "../helpers/encoding";
import { handleSetCommand, handleGetCommand, handleInfoCommand, handlePSyncCommand } from "./commandHandlers";

export const commandHandler = (commands: string[], connection: net.Socket) => {
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
