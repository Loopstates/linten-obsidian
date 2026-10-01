# Linten: llms.txt Validator & Scaffolder for Obsidian

[![Version](https://img.shields.io/badge/Obsidian_Plugin-v1.0.0-5271FF?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=linten)
[![VS Code Extension](https://img.shields.io/badge/VS_Code-Marketplace_Available-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=Loopstates.linten-vscode)
[![Spec Standard](https://img.shields.io/badge/Standard-LLMs.txt_Spec_v2-10B981?style=flat-square)](https://llmstxt.org)
[![Backend](https://img.shields.io/badge/Backend-Linten_Cloud_API-5271FF?style=flat-square)](https://linten.apps.loopstates.com)
[![Privacy](https://img.shields.io/badge/Privacy-Stateless_%2F_Zero_Data_Retention-success?style=flat-square)](https://loopstates.com)
[![Engineered By](https://img.shields.io/badge/Engineered_By-Loopstates-0A84FF?style=flat-square)](https://loopstates.com)

The definitive validator, link auditor, context budgeter, and scaffolding companion for **llms.txt** and **llms-full.txt** in Obsidian. Engineered by **[Loopstates](https://loopstates.com)**.

---

## Overview

Modern Large Language Models (LLMs) and autonomous research agents (ChatGPT Search, Perplexity AI, Claude Artifacts, Antigravity, Cursor, Copilot) prioritize structured, machine-readable markdown manifests over bloated HTML bundles.

Whether you maintain a public digital garden, corporate knowledge base, or private vault of technical notes, **Linten** provides in-vault AST validation, broken link detection, frontier AI token capacity gauges, and companion file synthesis directly inside Obsidian.

---

## Key Capabilities

* **Spec v2 AST Validation**: Instant compliance checks verifying single H1 titles, required blockquote summaries, and standard markdown list hierarchies.
* **100-Link Live Health Probe**: Concurrently verifies up to 100 links per document, flagging broken endpoints (404), redirect chains (301/302), and connection timeouts.
* **Frontier AI Model Context Budgeting**: Real-time token load multi-gauge comparing note footprints against Google Gemini 2.0 (1M), Claude 3.5 Sonnet (200k), OpenAI GPT-4o (128k), and DeepSeek-V3 (64k).
* **30 Spec-Compliant Industry Starter Presets**: Fuzzy search and load industry-tested templates for SaaS, Developer APIs, E-Commerce, Healthcare, Corporate Law, AI Infrastructure, Shopify, Notion, and more.
* **Companion Synthesis (`llms-full.txt`)**: Automatically crawls referenced documentation links to bundle un-truncated reference archives into your vault.
* **Canonical AST Auto-Formatter**: Normalizes inconsistent markdown to strict canonical `llms.txt` AST structure with a single click.
* **Remote Website / Domain Auditing**: Audit external documentation sites (e.g. `acme.com`) directly from Obsidian without needing a local file.
* **Dynamic Note Compliance Badge**: Generates live tamper-proof SVG badges verifying your domain's live `llms.txt` compliance score.
* **Vault Compliance Report Exporter**: Exports detailed audit findings, link health summaries, and token metrics into structured Markdown (`.md`) reports.
* **Cross-Platform Mobile Ready**: Built using Web Crypto (`crypto.subtle`) and native Obsidian `requestUrl`, ensuring identical performance across Desktop (macOS, Windows, Linux) and Mobile (iOS, iPadOS, Android).

---

## Available Commands

Access these actions via the Obsidian Command Palette (`Ctrl/Cmd + P`), ribbon icon, or note context menu:

| Command | Description |
|---|---|
| `Linten: Validate current note as llms.txt` | Audits the open note and displays the interactive audit modal with scores, findings, and quick actions. |
| `Linten: View last audit report` | Re-opens the most recent audit results without triggering a new network request. |
| `Linten: Audit remote website or URL` | Validates any remote website's `/llms.txt` manifest over the web. |
| `Linten: Insert industry starter template` | Fuzzy picker to search and apply 30 industry-specific starter templates. |
| `Linten: Audit live link health` | Concurrently probes up to 100 links in the note and displays latency, status codes, and redirect targets. |
| `Linten: Estimate frontier AI context budget` | Computes token footprint and context window utilization across frontier LLMs. |
| `Linten: Generate starter llms.txt from website` | Scaffolds a complete starter manifest from any live website URL. |
| `Linten: Synthesize companion llms-full.txt` | Aggregates all documentation links into a companion full-text file. |
| `Linten: Format note to canonical llms.txt AST conventions` | Cleans and normalizes headings, summaries, and bullet lists. |
| `Linten: Generate README / Note compliance badge` | Generates dynamic verification badge markdown or inserts it into the note. |
| `Linten: Export compliance audit report` | Saves a structured markdown report into your vault. |

---

## Editor Context Menu

Right-click anywhere inside an active markdown note or `llms.txt` file to quickly access:
* **Linten: Validate llms.txt**
* **Linten: Audit Link Health**
* **Linten: AI Context Budget**
* **Linten: Format to AST Spec**

---

## Privacy & Cloud Architecture

Linten uses a hybrid architecture designed for performance and privacy:

* **Local In-Vault Execution**: Template insertion (all 30 presets), document formatting, and frontier token metrics execute 100% locally inside Obsidian.
* **Linten Cloud API (`https://linten.apps.loopstates.com/api/v1`)**: Powers deep Spec v2 validation audits, the concurrent 100-link reachability probe, website scaffolding, and companion file synthesis.
* **HMAC-SHA256 Security**: All communication with Linten Cloud is authenticated using time-windowed HMAC-SHA256 signatures via standard W3C Web Crypto (`crypto.subtle`).
* **Stateless Zero Data Retention**: Linten Cloud operates entirely statelessly. Content sent for validation or link checking is analyzed strictly in-memory and is never logged, indexed, or stored on databases.

---

## Settings & Configuration

Configure settings under **Community Plugins → Linten**:

| Setting | Default | Description |
|---|---|---|
| **API Endpoint** | `https://linten.apps.loopstates.com/api/v1` | Enterprise endpoint for link checking and remote audits |
| **Live Link Probing** | `true` | Concurrently probes HTTP endpoints for reachability |
| **Validate on Save** | `true` | Automatically audits notes when saving with debounce |

---

## Enterprise Support & Ecosystem

Linten is part of the **Loopstates AI Retrieval Infrastructure Suite**:

* **Loopstates Official Website**: [https://loopstates.com](https://loopstates.com)
* **Linten Web Audit Platform**: [https://linten.apps.loopstates.com](https://linten.apps.loopstates.com)
* **Visual Studio Code Extension**: [Available on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Loopstates.linten-vscode)
* **GitHub Repository**: [https://github.com/loopstates/linten-obsidian](https://github.com/loopstates/linten-obsidian)
* **Official llms.txt Specification**: [https://llmstxt.org](https://llmstxt.org)

For inquiries, custom domain validation servers, or support, contact **hello@loopstates.com**.

---

## License

Proprietary &copy; 2026 [Loopstates](https://loopstates.com). All rights reserved.  
Source-available for personal evaluation and security auditing under the [Loopstates Client License](LICENSE). Commercial copying, rebranding, or competitive redistribution is strictly prohibited.
