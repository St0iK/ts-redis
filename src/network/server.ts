import * as net from "net";
import { commandParser } from "../command/parser";
import { commandHandler } from "../command";

export const server: net.Server = net.createServer((connection: net.Socket) => {
  connection.on("data", (input: Buffer) => {
    const commands = commandParser(input);
    commandHandler(commands, connection);
  });

  connection.on("end", () => {
    console.log("Client disconnected");
  });
});
