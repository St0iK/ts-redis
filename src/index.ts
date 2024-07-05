
import { config, handleCommandLineArgs } from "./config";
import { replicaHandshake } from "./network/replicaHandshate";
import { server } from "./network/server";


console.log("Redis server booted... 🚀");

handleCommandLineArgs(process.argv, config);

if (config.role === "slave") {
  replicaHandshake(config);
}

server.listen(config.port, "127.0.0.1");