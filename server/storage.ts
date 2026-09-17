// Object storage helpers. Manus Forge presign/S3 proxy is disabled.
// Uploads and signed URLs fail closed so staging never calls Manus storage hosts.

const DISABLED_MESSAGE =
  "Independent object storage is not configured; Manus Forge storage is disabled";

function refuseManusStorage(): never {
  throw new Error(DISABLED_MESSAGE);
}

export async function storagePut(
  _relKey: string,
  _data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  refuseManusStorage();
}

export async function storageGet(_relKey: string): Promise<{ key: string; url: string }> {
  refuseManusStorage();
}

export async function storageGetSignedUrl(_relKey: string): Promise<string> {
  refuseManusStorage();
}
