import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { HttpRequest } from "@smithy/protocol-http";

// 🔧 fill these
const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:442221f0-0b04-4480-8a25-b086fd0f28e0";
// Example: https://abc123xyz0.execute-api.us-east-1.amazonaws.com   (use $default stage so no trailing /stage)
const API_URL = "https://0xio19qm1k.execute-api.us-east-1.amazonaws.com";

const base = new URL(API_URL);
const HOST = base.host;
const PROTOCOL = base.protocol;
const BASEPATH = base.pathname.endsWith("/") ? base.pathname.slice(0, -1) : base.pathname;

const credentials = fromCognitoIdentityPool({
  identityPoolId: IDENTITY_POOL_ID,
  clientConfig: { region: REGION },
});

// NOTE: service = execute-api (not lambda)
const signer = new SignatureV4({
  service: "execute-api",
  region: REGION,
  credentials,
  sha256: Sha256,
});

export async function signedFetch(method = "GET", path = "/", bodyObj = null, extraHeaders = {}) {
  const norm = path.startsWith("/") ? path : `/${path}`;
  const fullPath = (BASEPATH || "") + norm;
  const body = bodyObj ? JSON.stringify(bodyObj) : undefined;

  const req = new HttpRequest({
    method,
    protocol: PROTOCOL,
    hostname: HOST,
    path: fullPath || "/",
    headers: {
      // host only for signing; we’ll drop it before fetch
      host: HOST,
      ...(body ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
    body,
  });

  const signed = await signer.sign(req);

  const headers = { ...signed.headers };
  delete headers.host; // browser forbids sending Host

  const res = await fetch(`${PROTOCOL}//${HOST}${fullPath || "/"}`, {
    method,
    headers,
    body,
  });

  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
