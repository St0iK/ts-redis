# Simple Redis implementation with Typescript

## Project Overview

This project is a fun and educational endeavor to build a Redis-like in-memory data structure store using TypeScript. The aim is to understand the underlying principles of Redis, improve TypeScript skills, and explore the internals of key-value stores.

## Example Commands

### Basic Commands

```sh
> ECHO hi
hi
```

```sh
> SET key1 value1
OK
> GET key1
"value1"
> DEL key1
1
> GET key1
(null)

> SET key1 value1 PX 100
OK
> GET key1
(null)
```


```
/src
  /commands
    - commandHandler.ts
    - commandParser.ts
    - commands.ts
  /config
    - config.ts
  /helpers
    - encoding.ts
    - generateReplID.ts
  /network
    - server.ts
    - replicaHandshake.ts
  /types
    - index.ts
  /store
    - kvStore.ts
  index.ts

```