import { makeError } from '../../../../i18n/index.js';
import { presignGetUrl, s3Fetch } from './awsSigV4.js';

export class R2Client {
  constructor(options = {}) {
    this.endpoint    = (options.r2Endpoint        || '').replace(/\/+$/, '');
    this.bucket      = (options.r2Bucket          || '');
    this.accessKeyId = (options.r2AccessKeyId     || '');
    this.secretKey   = (options.r2SecretAccessKey || '');
    this.region      = (options.r2Region          || 'auto');
    this.ttlSeconds  = Number.isFinite(Number(options.presignTtlS)) ? Number(options.presignTtlS) : 900;
  }

  assertConfigured() {
    if (!this.endpoint || !this.bucket || !this.accessKeyId || !this.secretKey) {
      throw makeError('cloud.notConfigured');
    }
  }

  opts() {
    return {
      endpoint   : this.endpoint,
      bucket     : this.bucket,
      region     : this.region,
      accessKeyId: this.accessKeyId,
      secretKey  : this.secretKey,
      ttlSeconds : this.ttlSeconds,
    };
  }

  presign(key) {
    this.assertConfigured();
    return presignGetUrl({ ...this.opts(), key });
  }

  async request({ method, key, body, contentType, query }) {
    this.assertConfigured();
    return s3Fetch({ ...this.opts(), method, key, body, contentType, query });
  }

  async listObjects(prefix = '') {
    this.assertConfigured();

    const objects = [];
    let continuationToken;

    do {
      const response = await this.request({
        method: 'GET',
        key: '',
        query: {
          'list-type': '2',
          prefix,
          'max-keys': '1000',
          'continuation-token': continuationToken,
        },
      });

      const xml = await response.text();

      for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []) {
        const key = decodeXmlEntities((block.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1] || '');
        const size = Number((block.match(/<Size>(\d+)<\/Size>/) || [])[1] || 0);
        if (key && !key.endsWith('/')) objects.push({ key, size });
      }

      const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
      continuationToken = truncated
        ? decodeXmlEntities((xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1] || '')
        : undefined;
    } while (continuationToken);

    return objects;
  }
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}