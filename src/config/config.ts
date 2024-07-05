import { RedisInstanceConfig } from "../types";
import { generateReplID } from "../helpers/generateReplID";

export const config: RedisInstanceConfig = {
  port: 6379,
  role: "master",
  masterReplicationId: generateReplID(),
  masterReplicationOffset: 0,
  replicas: [],
};

export const handleCommandLineArgs = (argv: string[], config: RedisInstanceConfig): void => {
  for (let i = 0; i < argv.length; i++) {
    const element = argv[i];
    switch (element) {
      case "--port":
        config.port = Number(argv[i + 1]);
        break;
      case "--replicaof":
        const [masterHost, masterPort] = argv[i + 1].split(" ");
        config.role = "slave";
        config.master = { host: masterHost, port: Number(masterPort) };
        break;
      default:
        break;
    }
  }
};
