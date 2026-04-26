const OBF_SALT = 'ani-obf-key';

const base64ToBytes = value => {
  const binary = globalThis.atob ? globalThis.atob(value) : '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const fallbackHash = value => {
  const text = String(value || '');
  const out = new Uint8Array(32);
  for (let i = 0; i < text.length; i += 1) {
    out[i % out.length] = (out[i % out.length] + text.charCodeAt(i) + i) % 256;
  }
  return out;
};

const deriveObfKey = async token => {
  const seed = `${OBF_SALT}:${token || ''}`;
  try {
    if (globalThis.crypto?.subtle) {
      const data = new TextEncoder().encode(seed);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      return new Uint8Array(digest);
    }
  } catch (_) {
    // Use deterministic fallback if subtle crypto is unavailable.
  }
  return fallbackHash(seed);
};

export const decodeObfuscatedPayload = async (payload, token) => {
  if (!payload || payload.alg !== 'xor-b64-v1' || typeof payload.obf !== 'string') {
    return payload;
  }
  const key = await deriveObfKey(token);
  const bytes = base64ToBytes(payload.obf);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return JSON.parse(new TextDecoder().decode(out));
};
