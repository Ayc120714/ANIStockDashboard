import {
  APP_UPDATE_APK_URL,
  APP_UPDATE_MANIFEST_URL,
  APP_VERSION_CODE,
  APP_VERSION_NAME,
} from '@core/config/appVersion';

function parseVersionParts(version) {
  return String(version || '0')
    .split('.')
    .map(part => parseInt(part, 10) || 0);
}

export function isRemoteVersionNewer(remoteVersion, installedVersion = APP_VERSION_NAME) {
  const remote = parseVersionParts(remoteVersion);
  const installed = parseVersionParts(installedVersion);
  const len = Math.max(remote.length, installed.length);
  for (let i = 0; i < len; i += 1) {
    const r = remote[i] || 0;
    const inst = installed[i] || 0;
    if (r > inst) return true;
    if (r < inst) return false;
  }
  return false;
}

export function isAppUpdateAvailable(manifest, {
  installedVersionCode = APP_VERSION_CODE,
  installedVersionName = APP_VERSION_NAME,
} = {}) {
  if (!manifest || typeof manifest !== 'object') return false;

  const remoteCode = Number(manifest.versionCode);
  const installedCode = Number(installedVersionCode);
  if (Number.isFinite(remoteCode) && Number.isFinite(installedCode) && remoteCode > installedCode) {
    return true;
  }

  if (manifest.version) {
    return isRemoteVersionNewer(manifest.version, installedVersionName);
  }

  return false;
}

export async function fetchAppUpdateManifest({timeoutMs = 8000} = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const url = `${APP_UPDATE_MANIFEST_URL}?t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    return {
      version: String(data.version || '').trim(),
      versionCode: Number(data.versionCode) || 0,
      apkUrl: String(data.apkUrl || APP_UPDATE_APK_URL).trim(),
      releaseNotes: String(data.releaseNotes || data.release_notes || '').trim(),
      builtAt: String(data.builtAt || data.built_at || '').trim(),
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Diagnostics for auto-update connectivity (Admin / support).
 * Returns whether DOWNLOAD.json is reachable and if a newer APK is published.
 */
export async function checkAppUpdateConnectivity({timeoutMs = 8000} = {}) {
  const started = Date.now();
  const manifest = await fetchAppUpdateManifest({timeoutMs});
  const latencyMs = Date.now() - started;

  if (!manifest) {
    return {
      ok: false,
      latencyMs,
      manifestUrl: APP_UPDATE_MANIFEST_URL,
      installed: {version: APP_VERSION_NAME, versionCode: APP_VERSION_CODE},
      updateAvailable: false,
      error: 'Could not reach update manifest (network, DNS, or server).',
    };
  }

  return {
    ok: true,
    latencyMs,
    manifestUrl: APP_UPDATE_MANIFEST_URL,
    installed: {version: APP_VERSION_NAME, versionCode: APP_VERSION_CODE},
    published: {
      version: manifest.version,
      versionCode: manifest.versionCode,
      builtAt: manifest.builtAt,
      apkUrl: manifest.apkUrl,
    },
    updateAvailable: isAppUpdateAvailable(manifest),
  };
}
