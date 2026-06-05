/**
 * Configuration de distribution (web).
 *
 * Le lien de téléchargement desktop pointe vers une release GitHub. L'éditeur n'héberge aucune
 * clé ni inférence (cf. CLAUDE.md) ; seul le binaire de l'app y est distribué.
 *
 * Pour publier une nouvelle version : bumper `DESKTOP_VERSION`, créer la release `v<version>`
 * et y attacher l'installeur nommé `PromptForge_<version>_x64-setup.exe`.
 */
const GITHUB_OWNER = 'Ethanol410';
const GITHUB_REPO = 'prompt-forge';

/** Version desktop courante (doit correspondre à `apps/desktop/src-tauri/tauri.conf.json`). */
export const DESKTOP_VERSION = '0.1.0';

/** Page du dépôt. */
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

/** Page « dernière release » (toujours valide une fois une release publiée). */
export const DESKTOP_RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`;

/** Lien direct vers l'installeur Windows (NSIS) de la version courante. */
export const DESKTOP_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/download/v${DESKTOP_VERSION}/PromptForge_${DESKTOP_VERSION}_x64-setup.exe`;
