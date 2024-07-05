import { config, handleCommandLineArgs } from "./config/config";
import { server } from "./network/server";
import { replicaHandshake } from "./network/replicaHandshake";

console.log("Redis server booted... 🚀");

handleCommandLineArgs(process.argv, config);

if (config.role === "slave") {
  replicaHandshake(config);
}

server.listen(config.port, "127.0.0.1");