import { createHmac, createHash } from 'node:crypto';

export const sha256hex = (data) =>
  createHash('sha256').update(data).digest('hex');

export const hmacSha256 = (key, data) =>
  createHmac('sha256', key).update(data).digest();

export const deriveSigningKey = (secretKey, dateStamp, region, service) => {
  const kDate    = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion  = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
};

export const isoDate = (date = new Date()) => {
  const iso = date.toISOString().replace(/[:-]|\.\d+/g, '');
  return { dateStamp: iso.slice(0, 8), amzDate: iso };
};

export const awsEncodeURIComponent = (str) =>
  encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export const presignGetUrl = ({ endpoint, bucket, region, accessKeyId, secretKey, key, ttlSeconds }) => {
  const service  = 's3';
  const now      = new Date();
  const { dateStamp, amzDate } = isoDate(now);
  const host     = new URL(`${endpoint}/${bucket}`).host;
  const path     = '/' + bucket + '/' + key.split('/').map(awsEncodeURIComponent).join('/');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential      = `${accessKeyId}/${credentialScope}`;

  const rawParams = [
    ['X-Amz-Algorithm',    'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential',   credential],
    ['X-Amz-Date',         amzDate],
    ['X-Amz-Expires',      String(ttlSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);

  const sortedQuery = rawParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    path,
    sortedQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = deriveSigningKey(secretKey, dateStamp, region, service);
  const signature  = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `${endpoint}${path}?${sortedQuery}&X-Amz-Signature=${signature}`;
};

export const canonicalPath = (bucket, key) =>
  key ? `/${bucket}/${key.split('/').map(awsEncodeURIComponent).join('/')}` : `/${bucket}`;

export const canonicalQuery = (query = {}) =>
  Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => [awsEncodeURIComponent(name), awsEncodeURIComponent(String(value))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');

export const buildAuthHeaders = ({ method, endpoint, bucket, region, accessKeyId, secretKey, key, contentType, body, query }) => {
  const service = 's3';
  const now     = new Date();
  const { dateStamp, amzDate } = isoDate(now);
  const host    = new URL(`${endpoint}/${bucket}`).host;
  const path    = canonicalPath(bucket, key);

  const payloadHash      = sha256hex(body ?? '');
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const credentialScope  = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalRequest = [method, path, canonicalQuery(query), canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');
  const signingKey       = deriveSigningKey(secretKey, dateStamp, region, service);
  const signature        = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    'Content-Type'         : contentType,
    'X-Amz-Content-Sha256' : payloadHash,
    'X-Amz-Date'           : amzDate,
    'Authorization'        : `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
    ...(body?.length != null ? { 'Content-Length': String(body.length) } : {}),
  };
};

export const s3Fetch = async (opts) => {
  const { endpoint, bucket, key, method, body, query, contentType = 'application/octet-stream' } = opts;

  const search  = canonicalQuery(query);
  const url     = `${endpoint}${canonicalPath(bucket, key)}${search ? `?${search}` : ''}`;
  const headers = buildAuthHeaders({ ...opts, contentType });

  const response = await fetch(url, { method, headers, body: body ?? undefined });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const e    = new Error(`R2 ${method} ${key || '(bucket)'} - [${response.status}] ${text}`);
    e.status   = response.status === 404 ? 404 : response.status >= 500 ? 502 : response.status;
    e.name     = response.status === 404 ? 'NoSuchKey' : 'R2Error';
    throw e;
  }

  return response;
};