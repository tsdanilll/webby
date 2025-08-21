// src/aws.js
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { HttpRequest } from "@smithy/protocol-http";

const REGION = "us-east-1"; // your region
const FN_URL = "https://4lugw2l2ooxz2c6po5ytwycmru0myjsx.lambda-url.us-east-1.on.aws";
const IDENTITY_POOL_ID = "us-east-1:442221f0-0b04-4480-8a25-b086fd0f28e0"; // replace with your Cognito identity pool ID

export async function signedFetch(method = "GET", path = "/", options = {}) {
  const url = new URL(path, FN_URL);

  const creds = await fromCognitoIdentityPool({
    clientConfig: { region: REGION },
    identityPoolId: IDENTITY_POOL_ID,
  })();

  const request = new HttpRequest({
    method,
    protocol: url.protocol,
    path: url.pathname,
    hostname: url.hostname,
    headers: {
      host: url.hostname,
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const signer = new SignatureV4({
    credentials: creds,
    region: REGION,
    service: "lambda",
    sha256: Sha256,
  });

  const signed = await signer.sign(request);

  return fetch(url.toString(), {
    method,
    headers: signed.headers,
    body: options.body,
  });
}
