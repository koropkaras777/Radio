export const xorDecrypt = (buf, token) => {
    const parts  = token.split('.');
    const b64    = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const keyRaw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const enc    = new Uint8Array(buf);
    const dec    = new Uint8Array(enc.length);
    for (let i = 0; i < enc.length; i++) dec[i] = enc[i] ^ keyRaw[i % keyRaw.length];
    return dec;
  };