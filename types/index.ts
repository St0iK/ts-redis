export interface RedisInstanceConfig {
  port: number;
  role: "master" | "slave";
  master?: {
    host: string;
    port: number;
  };
  masterReplicationId: string;
  masterReplicationOffset: number;
  replicas: Array<{
    connection: any;
    offset: number;
    active: boolean;
  }>;
}
