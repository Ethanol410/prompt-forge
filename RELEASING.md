# Publier une version (releases)

Les releases desktop sont **automatisées** : un workflow GitHub Actions
([`.github/workflows/release.yml`](.github/workflows/release.yml)) construit l'app et publie
les installeurs Windows (`.exe` + `.msi`) dès qu'un **tag de version** est poussé.

> Les commits sur `main` **ne créent pas** de release (volontaire). Seul un tag `v*` déclenche une release.

---

## TL;DR

```bash
# 1. Bumpe la version aux 2 endroits (doit être identique au futur tag)
#    - apps/desktop/src-tauri/tauri.conf.json  → "version"
#    - apps/web/src/config.ts                  → DESKTOP_VERSION

# 2. Commit + push
git commit -am "release v0.1.2"
git push

# 3. Tag + push du tag → déclenche la release automatique
git tag v0.1.2
git push origin v0.1.2
```

Suis l'avancement dans l'onglet **Actions** du dépôt (~3-5 min pour un build Windows).
À la fin, la release `v0.1.2` est créée avec les binaires attachés.

---

## Détails

### 1. Bumper la version

La version doit être **identique** à trois endroits (sinon le bouton « Télécharger » du site
pointera vers un fichier inexistant) :

| Fichier | Champ | Rôle |
|---|---|---|
| `apps/desktop/src-tauri/tauri.conf.json` | `version` | nom des binaires (`PromptForge_<version>_x64-setup.exe`) |
| `apps/web/src/config.ts` | `DESKTOP_VERSION` | lien de téléchargement du site web |
| le tag git | `vX.Y.Z` | déclencheur du workflow + nom de la release |

On suit le [semver](https://semver.org/lang/fr/) : `fix` → patch (`0.1.1`→`0.1.2`),
nouvelle feature → mineur (`0.1.x`→`0.2.0`).

### 2. Pousser le tag

```bash
git tag v0.1.2        # le "v" est obligatoire (le workflow écoute "v*")
git push origin v0.1.2
```

### 3. Ce que fait le workflow

1. checkout + Node 20 + toolchain Rust (avec cache),
2. `npm ci` (installe le monorepo),
3. `tauri build` dans `apps/desktop` (build le front web puis bundle l'app),
4. crée la **release GitHub** taggée et y attache `.exe` + `.msi`.

### Déclenchement manuel

Onglet **Actions → Release desktop → Run workflow**, en saisissant le tag voulu
(utile pour rejouer une release ou publier sans repasser par git en local).

---

## Déploiement web

Le site web est déployé sur **Vercel**, branché sur `main` : **chaque push sur `main`**
le redéploie automatiquement (aucune action requise). Voir `vercel.json`.

---

## Notes

- **Binaires non signés** : au premier lancement, Windows SmartScreen affiche « éditeur inconnu ».
  → *Informations complémentaires → Exécuter quand même*. (Signer nécessiterait un certificat
  Authenticode, configurable plus tard dans `tauri.conf.json`.)
- **Build Windows uniquement** : l'app utilise le keychain Windows (`keyring` feature
  `windows-native`) ; le workflow tourne donc sur `windows-latest`.
- **Erreur « tag already exists »** : si une release existe déjà pour ce tag, supprime-la
  (ou la release ET le tag) avant de relancer, ou bumpe vers la version suivante.
