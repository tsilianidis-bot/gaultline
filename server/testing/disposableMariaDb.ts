import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import { mariaBinary } from "./mariaBinary";

const LOOPBACK_HOST = "127.0.0.1";
const STARTUP_ATTEMPTS = 80;
const STARTUP_DELAY_MS = 125;

interface MariaIdentityRow extends RowDataPacket {
  datadir: string;
  port: number;
  pidFile: string;
}

export interface DisposableMariaDb {
  readonly host: typeof LOOPBACK_HOST;
  readonly port: number;
  readonly datadir: string;
  readonly childPid: number;
  readonly admin: Connection;
  createDatabase(name: string): Promise<Connection>;
  close(): Promise<void>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function freeLoopbackPort(): Promise<number> {
  const reservation = createServer();
  return await new Promise<number>((resolvePort, rejectPort) => {
    reservation.once("error", rejectPort);
    reservation.listen(
      { host: LOOPBACK_HOST, port: 0, exclusive: true },
      () => {
        const address = reservation.address();
        if (!address || typeof address === "string") {
          reservation.close();
          rejectPort(
            new Error(
              "Could not reserve a numeric loopback port for disposable MariaDB."
            )
          );
          return;
        }
        reservation.close(closeError => {
          if (closeError) {
            rejectPort(closeError);
            return;
          }
          resolvePort(address.port);
        });
      }
    );
  });
}

async function runProgram(
  program: string,
  argumentsList: string[]
): Promise<void> {
  await new Promise<void>((resolveProgram, rejectProgram) => {
    let stderr = "";
    let settled = false;
    const child = spawn(program, argumentsList, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${program} did not exit within 30 seconds.`));
    }, 30_000);

    function finish(error?: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectProgram(error);
      else resolveProgram();
    }

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", error =>
      finish(new Error(`Could not start ${program}: ${errorText(error)}`))
    );
    child.once("exit", (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(
        new Error(
          `${program} exited with code ${code ?? "null"} and signal ${signal ?? "none"}.${stderr ? `\n${stderr}` : ""}`
        )
      );
    });
  });
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs: number
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise<boolean>(resolveExit => {
    const timeout = setTimeout(() => {
      child.removeListener("exit", exited);
      resolveExit(false);
    }, timeoutMs);
    function exited(): void {
      clearTimeout(timeout);
      resolveExit(true);
    }
    child.once("exit", exited);
  });
}

async function stopMariaDb(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 5_000)) return;
  child.kill("SIGKILL");
  if (await waitForExit(child, 5_000)) return;
  throw new Error(
    `Disposable mariadbd PID ${child.pid ?? "unknown"} did not exit after SIGTERM and SIGKILL.`
  );
}

async function serverLog(errorLog: string): Promise<string> {
  try {
    return await readFile(errorLog, "utf8");
  } catch {
    return "(mariadbd did not write an error log)";
  }
}

async function waitForAdmin(
  port: number,
  child: ChildProcess,
  errorLog: string
): Promise<Connection> {
  let lastError: unknown = new Error(
    "mariadbd did not accept an admin connection."
  );
  for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Disposable mariadbd exited during startup (code ${child.exitCode ?? "null"}, signal ${child.signalCode ?? "none"}).\n${await serverLog(errorLog)}`
      );
    }
    try {
      return await createConnection({
        host: LOOPBACK_HOST,
        port,
        user: "root",
        multipleStatements: false,
        connectTimeout: 1_000,
      });
    } catch (error) {
      lastError = error;
      await delay(STARTUP_DELAY_MS);
    }
  }
  throw new Error(
    `Disposable mariadbd did not accept its credential-free root admin connection on ${LOOPBACK_HOST}:${port}: ${errorText(lastError)}\n${await serverLog(errorLog)}`
  );
}

async function readServerPid(pidFile: string): Promise<number> {
  let lastError: unknown = new Error(`PID file ${pidFile} was not readable.`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const pid = Number((await readFile(pidFile, "utf8")).trim());
      if (Number.isSafeInteger(pid) && pid > 0) return pid;
      lastError = new Error(
        `PID file ${pidFile} did not contain a positive integer.`
      );
    } catch (error) {
      lastError = error;
    }
    await delay(25);
  }
  throw new Error(
    `Could not read disposable mariadbd PID from ${pidFile}: ${errorText(lastError)}`
  );
}

export async function assertServerIdentity(
  admin: Connection,
  datadir: string,
  port: number,
  expectedPidFile: string,
  child: ChildProcess
): Promise<void> {
  const [rows] = await admin.query<MariaIdentityRow[]>(
    "SELECT @@datadir AS datadir, @@port AS port, @@pid_file AS pidFile"
  );
  const identity = rows[0];
  if (!identity)
    throw new Error(
      "Disposable MariaDB admin connection did not return server identity variables."
    );
  if (resolve(identity.datadir) !== resolve(datadir)) {
    throw new Error(
      `Disposable MariaDB datadir mismatch: expected ${datadir}, got ${identity.datadir}.`
    );
  }
  if (Number(identity.port) !== port) {
    throw new Error(
      `Disposable MariaDB port mismatch: expected ${port}, got ${identity.port}.`
    );
  }
  if (resolve(identity.pidFile) !== resolve(expectedPidFile)) {
    throw new Error(
      `Disposable MariaDB PID-file path mismatch: expected ${expectedPidFile}, got ${identity.pidFile}.`
    );
  }
  const pidFromServer = await readServerPid(identity.pidFile);
  if (pidFromServer !== child.pid) {
    throw new Error(
      `Disposable MariaDB PID mismatch: child PID ${child.pid ?? "unknown"}, server PID ${pidFromServer}.`
    );
  }
}

function databaseIdentifier(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(
      `Disposable MariaDB database name must contain only letters, numbers, and underscores: ${name}`
    );
  }
  return name;
}

/**
 * Starts an unprivileged MariaDB process backed by a fresh temporary datadir.
 * The returned admin connection is TCP-only and verified against the child PID,
 * so a caller cannot accidentally exercise a shared local server.
 */
export async function startDisposableMariaDb(): Promise<DisposableMariaDb> {
  const datadir = await mkdtemp(
    join(tmpdir(), "faultline-disposable-mariadb-")
  );
  const socket = join(datadir, "mariadb.sock");
  const pidFile = join(datadir, "mariadbd.pid");
  const errorLog = join(datadir, "mariadbd.err");
  let server: ChildProcess | undefined;
  let admin: Connection | undefined;
  let closed = false;

  try {
    const port = await freeLoopbackPort();
    await runProgram(mariaBinary("mariadb-install-db"), [
      "--no-defaults",
      `--datadir=${datadir}`,
      "--auth-root-authentication-method=normal",
      "--skip-test-db",
    ]);

    server = spawn(
      mariaBinary("mariadbd"),
      [
        "--no-defaults",
        `--datadir=${datadir}`,
        `--bind-address=${LOOPBACK_HOST}`,
        `--port=${port}`,
        `--socket=${socket}`,
        `--pid-file=${pidFile}`,
        `--log-error=${errorLog}`,
        "--skip-name-resolve",
        "--skip-log-bin",
        "--performance-schema=0",
        "--innodb-flush-method=fsync",
      ],
      { stdio: "ignore" }
    );

    admin = await waitForAdmin(port, server, errorLog);
    await assertServerIdentity(admin, datadir, port, pidFile, server);

    const ownedServer = server;
    const ownedAdmin = admin;
    return {
      host: LOOPBACK_HOST,
      port,
      datadir,
      childPid:
        ownedServer.pid ??
        (() => {
          throw new Error("Disposable mariadbd did not report a PID.");
        })(),
      admin: ownedAdmin,
      async createDatabase(name: string): Promise<Connection> {
        const database = databaseIdentifier(name);
        await ownedAdmin.query(`CREATE DATABASE \`${database}\``);
        return await createConnection({
          host: LOOPBACK_HOST,
          port,
          user: "root",
          database,
          multipleStatements: false,
        });
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        const cleanupErrors: unknown[] = [];
        try {
          await ownedAdmin.end();
        } catch (error) {
          cleanupErrors.push(error);
        }
        try {
          await stopMariaDb(ownedServer);
        } catch (error) {
          cleanupErrors.push(error);
        }
        try {
          await rm(datadir, { recursive: true, force: true });
        } catch (error) {
          cleanupErrors.push(error);
        }
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            cleanupErrors,
            "Disposable MariaDB cleanup failed."
          );
        }
      },
    };
  } catch (error) {
    try {
      await admin?.end();
    } finally {
      try {
        if (server) await stopMariaDb(server);
      } finally {
        await rm(datadir, { recursive: true, force: true });
      }
    }
    throw error;
  }
}
