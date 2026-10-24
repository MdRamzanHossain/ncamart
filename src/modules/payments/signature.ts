import crypto from "node:crypto";

/**
 * Verify SSLCommerz verify_sign signature.
 * Formula:
 * 1. Extract keys from comma-separated verify_key parameter.
 * 2. Collect field values corresponding to those keys.
 * 3. Add store_passwd = md5(storePasswd).
 * 4. Sort keys alphabetically (ksort).
 * 5. Build query string: key1=val1&key2=val2...
 * 6. md5(queryString) == verify_sign (case-insensitive).
 */
export function verifySslcommerzSignature(
  payload: Record<string, string>,
  storePasswd: string
): boolean {
  const verifySign = payload.verify_sign;
  const verifyKey = payload.verify_key;

  if (!verifySign || !verifyKey) {
    return false;
  }

  const keys = verifyKey.split(",").map((k) => k.trim());
  const data: Record<string, string> = {};

  for (const key of keys) {
    if (key in payload) {
      data[key] = payload[key] ?? "";
    }
  }

  const storePasswdMd5 = crypto
    .createHash("md5")
    .update(storePasswd)
    .digest("hex");
  data["store_passwd"] = storePasswdMd5;

  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map((k) => `${k}=${data[k]}`).join("&");
  const computedHash = crypto
    .createHash("md5")
    .update(queryString)
    .digest("hex");

  return computedHash.toLowerCase() === verifySign.toLowerCase();
}

/**
 * Generates valid verify_key and verify_sign for testing or simulation.
 */
export function generateSslcommerzSignature(
  payload: Record<string, string>,
  storePasswd: string
): { verify_sign: string; verify_key: string } {
  // Sort the payload keys to create verify_key list
  const keys = Object.keys(payload).filter(
    (k) => k !== "verify_sign" && k !== "verify_key"
  ).sort();
  const verifyKey = keys.join(",");

  const data: Record<string, string> = {};
  for (const key of keys) {
    data[key] = payload[key] ?? "";
  }

  const storePasswdMd5 = crypto
    .createHash("md5")
    .update(storePasswd)
    .digest("hex");
  data["store_passwd"] = storePasswdMd5;

  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map((k) => `${k}=${data[k]}`).join("&");
  const verifySign = crypto
    .createHash("md5")
    .update(queryString)
    .digest("hex");

  return {
    verify_sign: verifySign,
    verify_key: verifyKey,
  };
}
