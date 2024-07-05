import * as net from "net";
import { commandParser } from "../commands/commandParser";
import { commandHandler } from "../commands/commandHandler";
import { config } from "../config/config";

export const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.on("data", (input: Buffer) => {
    const commands = commandParser(input);
    commandHandler(commands, connection);
  });

  connection.on("end", () => {
    console.log("Client disconnected");
  });
});
