import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Connection } from "mysql2/promise";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertServerIdentity } from "./disposableMariaDb";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function identityConnection(datadir: string, port: number, pidFile: string) {
  const query = vi.fn().mockResolvedValue([[{ datadir, port, pidFile }]]);
  return { admin: { query } as unknown as Connection, query };
}
const child = { pid: 12345, exitCode: null, signalCode: null } as unknown as ChildProcess;

describe("disposable MariaDB requested identity", () => {
  it("rejects an unrequested PID-file path before file reads or any SQL write", async () => {
    const expectedDir = "/tmp/faultline-identity-expected";
    const expectedFile = join(expectedDir, "mariadbd.pid");
    const { admin, query } = identityConnection(expectedDir, 33333, "/tmp/faultline-unrequested.pid");
    await expect(assertServerIdentity(admin, expectedDir, 33333, expectedFile, child))
      .rejects.toThrow("PID-file path mismatch");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      "SELECT @@datadir AS datadir, @@port AS port, @@pid_file AS pidFile"
    );
  });

  it("accepts normalized requested paths only when the PID also matches", async () => {
    const datadir = await mkdtemp(join(tmpdir(), "faultline-identity-regression-"));
    directories.push(datadir);
    const pidFile = join(datadir, "mariadbd.pid");
    await writeFile(pidFile, "12345\n");
    const { admin, query } = identityConnection(`${datadir}/`, 33334, join(datadir, ".", "mariadbd.pid"));
    await expect(assertServerIdentity(admin, datadir, 33334, pidFile, child)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
