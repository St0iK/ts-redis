import * as net from "net";
import { RedisInstanceConfig } from "../types";
import { encodeArray } from "../helpers/encoding";
import { commandHandler } from "../command";
import { commandParser } from "../command/parser";

export const replicaHandshake = (config: RedisInstanceConfig): void => {
  if (!config.master) return;

  const connection = net.connect(config.master.port, config.master.host);
  connection.write(encodeArray(["PING"]));

  let stage = 0;
  const onData = (input: Buffer) => {
    console.log(input.toString());
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
