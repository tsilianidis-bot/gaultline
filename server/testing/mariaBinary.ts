import { existsSync } from "node:fs";
import { join } from "node:path";

/** Absolute path so CI and local shells find /usr/sbin even when PATH omits it. */
export function mariaBinary(name: "mariadb-install-db" | "mariadbd"): string {
  for (const dir of ["/usr/sbin", "/usr/bin", "/bin"]) {
    const path = join(dir, name);
    if (existsSync(path)) return path;
  }
  throw new Error(
    `${name} is not installed. Database tests require the mariadb-server package and do not skip.`,
  );
}
