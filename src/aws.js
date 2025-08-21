// src/aws.js
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { HttpRequest } from "@smithy/protocol-http";

const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:442221f0-0b04-4480-8a25-b086fd0f28e0";
const FN_URL = "https://4lugw2l2ooxz2c6po5ytwycmru0myjsx.lambda-url.us-east-1.on.aws/";

const base = new URL(FN_URL);
const HOST = base.host;
const PROTOCOL = base.protocol;
const BASEPATH = base.pathname.endsWith("/") ? base.pathname.slice(0, -1) : base.pathname;

const credentials = fromCognitoIdentityPool({
  identityPoolId: IDENTITY_POOL_ID,
  clientConfig: { region: REGION },
});

const signer = new SignatureV4({
  service: "lambda",
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
      // include host for signing only
      host: HOST,
      "content-type": body ? "application/json" : undefined, // don't set on GET
      ...extraHeaders,
    },
    body,
  });

  const signed = await signer.sign(req);

  // 🚫 strip forbidden header before fetch
  const fetchHeaders = { ...signed.headers };
  delete fetchHeaders.host;

  const res = await fetch(`${PROTOCOL}//${HOST}${fullPath || "/"}`, {
    method,
    headers: fetchHeaders,
    body,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
