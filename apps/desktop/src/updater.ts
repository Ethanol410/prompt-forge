import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Vérifie au lancement s'il existe une mise à jour signée (Tauri updater), propose de l'installer,
 * puis redémarre. Silencieux en cas d'échec (hors-ligne, pas de release, etc.) — on n'embête pas
 * l'utilisateur. La signature des updates garantit l'intégrité (clé updater, gratuite).
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;
    const ok = window.confirm(
      `Une mise à jour est disponible (v${update.version}).\n\nL'installer et redémarrer maintenant ?`,
    );
    if (!ok) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch {
    /* pas de réseau / pas de release / etc. : on ignore */
  }
}
