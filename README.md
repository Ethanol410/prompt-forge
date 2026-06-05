<div align="center">

# 🔨 PromptForge

**Transforme une idée en _meilleur prompt_.**

Générateur de prompts optimisés (web + desktop) qui structure ton intention en langage naturel
en un prompt clair, contraint et réutilisable — avec **ta propre clé d'API** ou un **modèle local**.

Le livrable, c'est le prompt : tu l'emportes où tu veux.

[Démarrage web](#-démarrage-rapide-web) · [Télécharger pour Windows](https://github.com/Ethanol410/prompt-forge/releases/latest) · [Sécurité](#-sécurité--confidentialité)

</div>

---

## ✨ Pourquoi

La qualité d'une sortie LLM dépend massivement de la qualité du prompt. PromptForge applique les
bonnes pratiques de prompt engineering à ta place : rôle, contexte, étapes, **contraintes
vérifiables**, format de sortie — sans que tu aies à les connaître.

> **BYOK / modèle local — tes clés ne quittent jamais ton appareil.** Aucune clé ni intention n'est
> envoyée à un serveur de l'éditeur. L'inférence va **directement** du client vers le provider, ou
> reste **100 % locale**.

## 🚀 Fonctionnalités

- **4 catégories** prêtes à l'emploi : PRD technique · Code / Code review · Email / Comms · Design / UX
- **Génération hybride** : template structurant + une passe d'optimisation par le modèle
- **Affinage guidé** (plus court / technique / formel) et **comparaison A/B** brut ↔ optimisé
- **Templates personnalisés** avec **variables**, **score qualité** heuristique
- **Historique local**, copie en un clic, **export** (.md / .txt / prêt pour Claude Code)
- **Streaming** token-par-token, **estimation de coût**, raccourci `Ctrl/Cmd+Entrée`, bouton **Stop**

## 🔌 Providers

| Provider | Web | Desktop |
|---|:---:|:---:|
| Anthropic | ✅ | ✅ |
| Ollama (local) | ✅ | ✅ |
| LM Studio (local) | ✅ | ✅ |
| OpenRouter | ✅ | ✅ |
| OpenAI | ⛔ *(CORS)* | ✅ |
| Mistral | ⛔ *(CORS)* | ✅ |
| Gemini | ⛔ *(CORS)* | ✅ |

Sur le web, les providers qui bloquent les appels navigateur (CORS) sont réservés au desktop, qui
passe par un client HTTP natif (Rust). **Aucun proxy d'inférence** côté éditeur.

## 🔒 Sécurité & confidentialité

Invariants non négociables :

- Clé utilisateur **jamais** envoyée à un backend éditeur, **jamais** loggée, **jamais** en clair.
- Inférence **directe** client → provider (aucun proxy d'inférence).
- **Desktop** : clés dans le **keychain de l'OS** (Windows Credential Manager via `keyring-rs`).
- **Web** : clés chiffrées en **AES-GCM 256 (WebCrypto)** avant IndexedDB — jamais en clair, jamais
  dans `localStorage`. **CSP stricte**.
- **Modèle local = 100 % hors-ligne**, aucune requête externe.
- Analytics : événements anonymisés uniquement, jamais de contenu utilisateur.

## 💾 Télécharger (desktop)

Dernière version sur la **[page des releases](https://github.com/Ethanol410/prompt-forge/releases/latest)** :
- `PromptForge_<version>_x64-setup.exe` — installeur Windows (recommandé)
- `PromptForge_<version>_x64_en-US.msi` — alternative MSI

> ⚠️ Binaire **non signé** : au premier lancement, Windows SmartScreen affiche « éditeur inconnu ».
> Clique **Informations complémentaires → Exécuter quand même**.

## 🧑‍💻 Démarrage rapide (web)

Prérequis : **Node ≥ 20**.

```bash
npm install
npm run dev -w @promptforge/web   # http://localhost:5173
```

La landing s'ouvre sur `/` ; l'app sur `/app`.

### Application desktop (Tauri)

Prérequis : **Rust** (rustup/cargo) + **Microsoft C++ Build Tools** + **WebView2**.

```bash
npm run tauri:dev   -w @promptforge/desktop   # dev
npm run tauri:build -w @promptforge/desktop   # installeur → src-tauri/target/release/bundle
```

## 🏗️ Architecture

Monorepo **npm workspaces**, architecture **ports & adapters** : le cœur est agnostique de la
plateforme et ne dépend que de 3 ports (`SecretStore`, `HistoryStore`, `HttpClient`) ; chaque app
fournit ses adaptateurs.

```
packages/
  core/   # TS pur — modèles, ports, providers, moteur de génération (aucune dépendance plateforme)
  ui/     # composants React partagés (thème dessiné)
apps/
  web/      # Vite + React — adapters fetch / WebCrypto / IndexedDB
  desktop/  # Tauri 2 (Rust) — adapters keychain / SQLite / HTTP natif
```

C'est ce qui implémente la décision **D2** : sur web, le transport `fetch` ne peut pas débloquer
OpenAI (CORS) ; sur desktop, le transport HTTP natif Rust le débloque. Ajouter un provider = un
adaptateur, sans toucher au cœur.

## 🧰 Stack

React · TypeScript · Vite · Tailwind CSS v4 · Tauri 2 (Rust) · Vitest · Playwright ·
thème « dessiné main » (Caveat / Nunito / JetBrains Mono, Rough.js).

## 🔁 Workflow de dev

```bash
npm run typecheck   # tsc --build (composite)
npm run lint:fix    # ESLint
npm test            # Vitest (unitaires)
npm run test:e2e    # Playwright (web)
```

Critère de fin d'une tâche : **typecheck + lint + tests** au vert.

## 📄 Licence

À définir.
