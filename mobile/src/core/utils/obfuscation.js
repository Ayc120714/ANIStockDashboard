const OBF_SALT = 'ani-obf-key';

const decodeBase64Manually = value => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(value || '').replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 payload');
  }
  for (let bc = 0, bs = 0, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    buffer = chars.indexOf(buffer);
    if (buffer < 0) {
      continue;
    }
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      output += String.fromCharCode((255 & (bs >> ((-2 * bc) & 6))));
    }
  }
  return output;
};

const base64ToBytes = value => {
  const binary = globalThis.atob ? globalThis.atob(value) : decodeBase64Manually(value);
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
  try {
    const key = await deriveObfKey(token);
    const bytes = base64ToBytes(payload.obf);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      out[i] = bytes[i] ^ key[i % key.length];
    }
    return JSON.parse(new TextDecoder().decode(out));
  } catch (_) {
    // Never crash startup if obfuscated payload decode fails on device.
    return payload;
  }
};
