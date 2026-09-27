import {
  Plugin,
  Notice,
  MarkdownView,
  TFile,
  normalizePath,
  Menu,
  Editor,
  addIcon
} from 'obsidian';
import { LintenSettings, DEFAULT_SETTINGS, LintenSettingTab } from './settings';
import {
  validateNoteContent,
  auditRemoteUrlNote,
  generateStarterNote,
  synthesizeFullNote,
  checkNoteLinks,
  LintenValidationResponse
} from './apiClient';
import {
  LintenAuditModal,
  LintenLinkAuditModal,
  LintenBudgetModal,
  LintenTemplateModal,
  LintenPromptModal,
  LintenBadgeModal
} from './modal';
import { IndustryTemplate } from './templates';
import { LINTEN_ICON_ID, LINTEN_ICON_CONTENT } from './logo';

export default class LintenPlugin extends Plugin {
  settings: LintenSettings;
  statusBarItemEl: HTMLElement;
  lastAuditResponse: LintenValidationResponse | null = null;
  lastAuditDocName: string = '';
  private modifyDebounceTimer: number | null = null;

  async onload() {
    await this.loadSettings();

    // 1. Register Authentic Linten Vector Logo Icon
    addIcon(LINTEN_ICON_ID, LINTEN_ICON_CONTENT);

    // 2. Register .txt files as native Markdown in Obsidian
    // This allows llms.txt and llms-full.txt to be visible and directly editable in the vault
    try {
      this.registerExtensions(['txt'], 'markdown');
    } catch {
      console.warn('Linten notice: .txt extension already registered by another plugin or system.');
    }

    // 3. Ribbon Icon using Authentic Linten Logo
    this.addRibbonIcon(LINTEN_ICON_ID, 'Linten: Validate llms.txt', async () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.file || !this.isLlmsFile(activeView.file)) {
        const currentName = activeView?.file?.name ? `"${activeView.file.name}"` : 'Active note';
        new Notice(`Linten: ${currentName} is not an llms.txt manifest. Please open an llms.txt or llms-full.txt file to validate.`);
        return;
      }
      await this.validateFile(activeView.file, true);
    });

    // 4. Status Bar Item
    this.statusBarItemEl = this.addStatusBarItem();
    this.statusBarItemEl.addClass('linten-status-bar');
    this.updateStatusBar(null);
    this.statusBarItemEl.onClickEvent(() => {
      if (this.lastAuditResponse) {
        this.openAuditModal(this.lastAuditDocName, this.lastAuditResponse);
      } else {
        void this.validateActiveNote();
      }
    });

    // 5. Command: Validate Current Note
    this.addCommand({
      id: 'validate-current-note',
      name: 'Validate current note as llms.txt',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file && this.isLlmsFile(activeView.file)) {
          if (!checking) {
            void this.validateActiveNote();
          }
          return true;
        }
        return false;
      }
    });

    // 6. Command: View Last Audit Report
    this.addCommand({
      id: 'show-last-report',
      name: 'View last audit report',
      callback: () => {
        if (this.lastAuditResponse) {
          this.openAuditModal(this.lastAuditDocName, this.lastAuditResponse);
        } else {
          void this.validateActiveNote();
        }
      }
    });

    // 7. Command: Audit Remote Domain or URL
    this.addCommand({
      id: 'audit-domain',
      name: 'Audit remote website or URL (e.g. stripe.com)',
      callback: () => {
        new LintenPromptModal(this.app, {
          title: 'Linten: Audit Remote Domain or URL',
          placeholder: 'stripe.com or https://docs.anthropic.com/llms.txt',
          initialValue: '',
          submitLabel: 'Audit URL',
          onSubmit: (url: string) => {
            if (!url) return;
            void this.auditRemoteUrl(url);
          }
        }).open();
      }
    });

    // 8. Command: Insert Industry Starter Template (30 Presets)
    this.addCommand({
      id: 'insert-template',
      name: 'Insert industry starter template (30 presets)',
      callback: () => {
        new LintenTemplateModal(this.app, (template: IndustryTemplate) => {
          void (async () => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
              const currentText = activeView.editor.getValue().trim();
              if (!currentText) {
                activeView.editor.setValue(template.content);
                new Notice(`Applied "${template.name}" template to active note.`);
                return;
              }
            }

            // Use .txt if vault supports it or matches active convention
            const ext = activeView?.file?.extension === 'md' ? 'md' : 'txt';
            const baseName = `llms-${template.id}.${ext}`;
            try {
              const newFile = await this.createUniqueVaultFile(baseName, template.content);
              const leaf = this.app.workspace.getLeaf(false);
              await leaf.openFile(newFile);
              new Notice(`Created "${newFile.name}" with "${template.name}" template.`);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              new Notice(`Could not create note: ${msg}`);
            }
          })();
        }).open();
      }
    });

    // 9. Command: Audit Live Link Health (100-Link Probing)
    this.addCommand({
      id: 'audit-links',
      name: 'Audit live link health (100-link probe)',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
          if (!checking) {
            void this.auditNoteLinks(activeView.file);
          }
          return true;
        }
        return false;
      }
    });

    // 10. Command: Show Frontier AI Model Context Budgeting
    this.addCommand({
      id: 'show-ai-budget',
      name: 'Estimate frontier AI context budget',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
          if (!checking) {
            const content = activeView.editor.getValue();
            new LintenBudgetModal(this.app, activeView.file.name, content).open();
          }
          return true;
        }
        return false;
      }
    });

    // 11. Command: Generate Starter llms.txt from website
    this.addCommand({
      id: 'generate-starter',
      name: 'Generate starter llms.txt from website',
      callback: () => {
        new LintenPromptModal(this.app, {
          title: 'Linten: Scaffold Starter llms.txt',
          placeholder: 'stripe.com or loopstates.com',
          initialValue: '',
          submitLabel: 'Generate Starter',
          onSubmit: (domain: string) => {
            if (!domain) return;
            void this.generateStarterFromDomain(domain);
          }
        }).open();
      }
    });

    // 12. Command: Synthesize Companion llms-full.txt
    this.addCommand({
      id: 'synthesize-full',
      name: 'Synthesize companion llms-full.txt from links',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file && this.isLlmsFile(activeView.file)) {
          if (!checking) {
            void this.synthesizeFull(activeView.file);
          }
          return true;
        }
        return false;
      }
    });

    // 13. Command: Canonical AST Auto-Formatter
    this.addCommand({
      id: 'format-spec',
      name: 'Format note to canonical llms.txt AST conventions',
      editorCallback: (editor: Editor) => {
        const text = editor.getValue();
        const formatted = this.formatMarkdown(text);
        editor.setValue(formatted);
        new Notice('Note formatted according to canonical llms.txt conventions.');
      }
    });

    // 14. Command: Generate README / Note Compliance Badge
    this.addCommand({
      id: 'generate-badge',
      name: 'Generate README / Note compliance badge',
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let domain = 'loopstates.com';
        if (activeView) {
          const content = activeView.editor.getValue();
          const match = content.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (match) domain = match[1];
        }

        new LintenBadgeModal(this.app, domain, (snippet: string) => {
          if (activeView && activeView.editor) {
            const cursor = activeView.editor.getCursor();
            activeView.editor.replaceRange(`\n${snippet}\n`, cursor);
            new Notice('Inserted Linten verification badge into active note.');
          }
        }).open();
      }
    });

    // 15. Command: Export Compliance Audit Report
    this.addCommand({
      id: 'export-report',
      name: 'Export compliance audit report (.md or .json)',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file && this.isLlmsFile(activeView.file)) {
          if (!checking) {
            void this.exportReportForActiveFile(activeView.file);
          }
          return true;
        }
        return false;
      }
    });

    // 16. Editor Context Menu Integration
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
        if (!view.file || !this.isLlmsFile(view.file)) return;

        menu.addSeparator();
        menu.addItem(item => {
          item.setTitle('Linten: Validate llms.txt')
            .setIcon(LINTEN_ICON_ID)
            .onClick(() => this.validateFile(view.file, true));
        });
        menu.addItem(item => {
          item.setTitle('Linten: Audit Link Health')
            .setIcon('link')
            .onClick(() => this.auditNoteLinks(view.file));
        });
        menu.addItem(item => {
          item.setTitle('Linten: AI Context Budget')
            .setIcon('gauge')
            .onClick(() => new LintenBudgetModal(this.app, view.file.name, editor.getValue()).open());
        });
        menu.addItem(item => {
          item.setTitle('Linten: Format to AST Spec')
            .setIcon('wand-2')
            .onClick(() => {
              editor.setValue(this.formatMarkdown(editor.getValue()));
              new Notice('Formatted to llms.txt AST conventions.');
            });
        });
      })
    );

    // 17. Settings Tab
    this.addSettingTab(new LintenSettingTab(this.app, this));

    // 18. Auto-validate with Debounce (Prevents API spamming on continuous keystrokes)
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (
          this.settings.validateOnSave &&
          file instanceof TFile &&
          this.isLlmsFile(file)
        ) {
          if (this.modifyDebounceTimer !== null) {
            window.clearTimeout(this.modifyDebounceTimer);
          }
          this.modifyDebounceTimer = window.setTimeout(async () => {
            await this.validateFile(file, false);
            this.modifyDebounceTimer = null;
          }, 1500);
        }
      })
    );
  }

  onunload() {
    if (this.modifyDebounceTimer !== null) {
      window.clearTimeout(this.modifyDebounceTimer);
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<LintenSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  isLlmsFile(file: TFile): boolean {
    const name = file.name.toLowerCase();
    return (
      name === 'llms.txt' ||
      name === 'llms-full.txt' ||
      name === 'llms.md' ||
      name === 'llms-full.md' ||
      name === 'llms-small.txt' ||
      name === 'llms-small.md' ||
      name.startsWith('llms-') ||
      name.startsWith('llms_')
    );
  }

  private checkVaultHasCompanion(file: TFile): boolean {
    const nameLower = file.name.toLowerCase();
    if (nameLower.includes('-full') || nameLower.includes('_full')) {
      return true;
    }

    // 1. Check siblings in the same folder
    if (file.parent && file.parent.children) {
      for (const child of file.parent.children) {
        if (child instanceof TFile && child.path !== file.path) {
          const childName = child.name.toLowerCase();
          if (
            childName === 'llms-full.txt' ||
            childName === 'llms-full.md' ||
            childName.startsWith(`${file.basename}-full`) ||
            childName.startsWith(`${file.basename}_full`) ||
            childName.includes('-full') ||
            childName.includes('_full')
          ) {
            return true;
          }
        }
      }
    }

    // 2. Check anywhere across the entire vault
    const allFiles = this.app.vault.getFiles();
    for (const f of allFiles) {
      if (f.path !== file.path) {
        const fname = f.name.toLowerCase();
        if (
          fname === 'llms-full.txt' ||
          fname === 'llms-full.md' ||
          fname.startsWith('llms-full') ||
          fname.startsWith('llms_full')
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private updateStatusBar(score: number | null, response?: LintenValidationResponse) {
    if (score !== null) {
      const color = score >= 90 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';
      this.statusBarItemEl.setText(`Linten: ${score}/100`);
      this.statusBarItemEl.setCssStyles({ color });
      
      const report = response?.report?.scores;
      const spec = response?.specialist?.metrics;
      let tooltip = `Linten llms.txt Validator\nScore: ${score}/100\n`;
      if (report) {
        tooltip += `Structure: ${report.structure}% | Links: ${report.links}% | Best Practices: ${report.bestPractices}%\n`;
      }
      if (spec) {
        tooltip += `AI Tokens: ~${spec.estimatedTokens.toLocaleString()} (${spec.wordCount} words)\n`;
      }
      tooltip += 'Click to open audit details';
      this.statusBarItemEl.setAttribute('aria-label', tooltip);
      this.statusBarItemEl.setAttribute('title', tooltip);
    } else {
      this.statusBarItemEl.setText('Linten');
      this.statusBarItemEl.setCssStyles({ color: '#5271FF' });
      this.statusBarItemEl.setAttribute('aria-label', 'Linten: llms.txt Validator by Loopstates. Click to audit.');
      this.statusBarItemEl.setAttribute('title', 'Linten: llms.txt Validator by Loopstates. Click to audit.');
    }
  }

  async validateActiveNote() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) {
      new Notice('No active note to validate.');
      return;
    }
    if (!this.isLlmsFile(activeView.file)) {
      new Notice(`Linten: "${activeView.file.name}" is not an llms.txt manifest. Please open an llms.txt or llms-full.txt note to audit.`);
      return;
    }
    await this.validateFile(activeView.file, true);
  }

  async validateFile(file: TFile, openModal: boolean = true) {
    if (!this.isLlmsFile(file)) {
      new Notice(`Linten: "${file.name}" is not an llms.txt manifest. Please open an llms.txt or llms-full.txt note to audit.`);
      return;
    }

    const content = await this.app.vault.read(file);
    if (!content.trim()) {
      new Notice('Note is empty.');
      return;
    }

    this.statusBarItemEl.setText('Linten: Auditing...');
    this.statusBarItemEl.setCssStyles({ color: '#5271FF' });
    new Notice(`Linten: Auditing ${file.name}...`);

    try {
      const response = await validateNoteContent(this.settings.apiUrl, content);

      // Check companion parity inside the local vault
      if (!response.specialist) {
        response.specialist = {};
      }
      if (!response.specialist.dualFileParity) {
        response.specialist.dualFileParity = {
          hasCompanion: false,
          companionRecommendation: ''
        };
      }
      if (this.checkVaultHasCompanion(file)) {
        response.specialist.dualFileParity.hasCompanion = true;
      }

      const score = response.report?.scores?.overall ?? 100;
      
      this.lastAuditResponse = response;
      this.lastAuditDocName = file.name;
      this.updateStatusBar(score, response);

      if (openModal) {
        this.openAuditModal(file.name, response, file);
      } else {
        new Notice(`Linten: Audit complete. Score: ${score}/100`);
      }
    } catch (err: unknown) {
      this.statusBarItemEl.setText('Linten: Error');
      this.statusBarItemEl.setCssStyles({ color: '#EF4444' });
      const msg = err instanceof Error ? err.message : 'Network error';
      new Notice(`Linten Validation failed: ${msg}`);
    }
  }

  async auditRemoteUrl(targetUrl: string) {
    new Notice(`Linten: Auditing remote URL ${targetUrl}...`);
    this.statusBarItemEl.setText('Linten: Auditing...');
    this.statusBarItemEl.setCssStyles({ color: '#5271FF' });

    try {
      const response = await auditRemoteUrlNote(this.settings.apiUrl, targetUrl);
      const score = response.report?.scores?.overall ?? 100;

      this.lastAuditResponse = response;
      this.lastAuditDocName = targetUrl;
      this.updateStatusBar(score, response);

      this.openAuditModal(targetUrl, response);
      new Notice(`Linten: Remote audit complete for ${targetUrl} (Score: ${score}/100)`);
    } catch (err: unknown) {
      this.statusBarItemEl.setText('Linten: Error');
      this.statusBarItemEl.setCssStyles({ color: '#EF4444' });
      const msg = err instanceof Error ? err.message : 'Network error';
      new Notice(`Remote Audit failed: ${msg}`);
    }
  }

  private openAuditModal(docName: string, response: LintenValidationResponse, file?: TFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const targetFile = file || activeView?.file;
    if (targetFile && this.checkVaultHasCompanion(targetFile)) {
      if (!response.specialist) response.specialist = {};
      if (!response.specialist.dualFileParity) {
        response.specialist.dualFileParity = { hasCompanion: true, companionRecommendation: '' };
      } else {
        response.specialist.dualFileParity.hasCompanion = true;
      }
    }

    new LintenAuditModal(this.app, docName, response, (action: string) => {
      void (async () => {
        const returnToAudit = () => this.openAuditModal(docName, response, targetFile);

        if (action === 'audit-links') {
          if (targetFile) {
            await this.auditNoteLinks(targetFile, returnToAudit);
          } else {
            new Notice('Open an active note to audit links.');
          }
        } else if (action === 'budget') {
          if (activeView) {
            new LintenBudgetModal(this.app, docName, activeView.editor.getValue(), returnToAudit).open();
          } else {
            new Notice('Open an active note to estimate budget.');
          }
        } else if (action === 'format') {
          if (activeView) {
            const original = activeView.editor.getValue();
            const formatted = this.formatMarkdown(original);
            if (original.trim() === formatted.trim()) {
              new Notice('Linten: Note is already formatted to canonical llms.txt standard (no changes needed).');
              returnToAudit();
            } else {
              activeView.editor.setValue(formatted);
              new Notice('Linten: Formatted note to canonical llms.txt structure (H1, blockquote, H2s, normalized links).');
              if (targetFile) {
                await this.validateFile(targetFile, true);
              }
            }
          }
        } else if (action === 'export') {
          if (targetFile) {
            await this.exportReportForActiveFile(targetFile);
          } else {
            await this.exportReportStandalone(docName, response);
          }
        } else if (action === 'badge') {
          let detectedDomain = '';
          if (activeView) {
            const content = activeView.editor.getValue();
            const match = content.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (match) detectedDomain = match[1];
          }
          new LintenBadgeModal(
            this.app,
            detectedDomain || 'loopstates.com',
            (snippet: string) => {
              if (activeView && activeView.editor) {
                const cursor = activeView.editor.getCursor();
                activeView.editor.replaceRange(`\n${snippet}\n`, cursor);
                new Notice('Inserted Linten verification badge into active note.');
              }
            },
            returnToAudit
          ).open();
        } else if (action === 'synthesize') {
          if (targetFile) {
            await this.synthesizeFull(targetFile);
          }
        }
      })();
    }).open();
  }

  async auditNoteLinks(file: TFile, onBack?: () => void) {
    const content = await this.app.vault.read(file);
    if (!content.trim()) {
      new Notice('Note is empty.');
      return;
    }

    new Notice('Linten: Probing link health concurrently...');

    try {
      const report = await checkNoteLinks(this.settings.apiUrl, content);
      new LintenLinkAuditModal(this.app, file.name, report, onBack).open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Linten Link Auditor error: ${msg}`);
    }
  }

  async generateStarterFromDomain(domain: string) {
    const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    new Notice(`Linten: Scaffolding starter llms.txt for ${cleanDomain}...`);

    try {
      const res = await generateStarterNote(this.settings.apiUrl, cleanDomain);
      if (res.content) {
        const filePath = `llms-${cleanDomain.replace(/\..*$/, '')}.txt`;
        const newFile = await this.createUniqueVaultFile(filePath, res.content);
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(newFile);
        new Notice(`Created "${newFile.name}" successfully.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Scaffolding failed: ${msg}`);
    }
  }

  async synthesizeFull(file: TFile) {
    if (!this.isLlmsFile(file)) {
      new Notice(`Linten: "${file.name}" is not an llms.txt manifest.`);
      return;
    }

    const content = await this.app.vault.read(file);
    if (!content.trim()) {
      new Notice('Note is empty.');
      return;
    }

    const hasLinks = /- \[[^\]]+\]\([^)]+\)/.test(content) || /\[[^\]]+\]\([^)]+\)/.test(content);
    if (!hasLinks) {
      new Notice('Linten: No markdown links found in this manifest to synthesize.');
      return;
    }

    new Notice('Linten: Synthesizing companion llms-full.txt from links...');

    try {
      const res = await synthesizeFullNote(this.settings.apiUrl, content);
      if (res.fullContent) {
        const ext = file.extension === 'md' ? '.md' : '.txt';
        const fullFileName = normalizePath(file.path.replace(/\.[^/.]+$/, '') + '-full' + ext);
        
        let targetFile = this.app.vault.getAbstractFileByPath(fullFileName);
        if (targetFile instanceof TFile) {
          await this.app.vault.modify(targetFile, res.fullContent);
        } else {
          targetFile = await this.app.vault.create(fullFileName, res.fullContent);
        }

        if (this.lastAuditResponse?.specialist?.dualFileParity) {
          this.lastAuditResponse.specialist.dualFileParity.hasCompanion = true;
        }

        if (targetFile instanceof TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(targetFile);
        }

        new Notice(
          `Linten: Companion manifest successfully created (~${res.metrics.estimatedTokens.toLocaleString()} tokens).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Synthesizer failed: ${msg}`);
    }
  }

  async exportReportForActiveFile(file: TFile) {
    if (!this.lastAuditResponse) {
      await this.validateFile(file, false);
    }
    if (!this.lastAuditResponse) return;

    const baseName = file.basename;
    const reportFileName = `${baseName}-audit-report.md`;
    const markdownReport = this.buildMarkdownReport(file.name, this.lastAuditResponse);

    try {
      const reportFile = await this.createUniqueVaultFile(reportFileName, markdownReport);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(reportFile);
      new Notice(`Exported compliance audit report to "${reportFile.name}".`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Failed to export report: ${msg}`);
    }
  }

  async exportReportStandalone(docName: string, response: LintenValidationResponse) {
    const cleanName = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const reportFileName = `${cleanName}-audit-report.md`;
    const markdownReport = this.buildMarkdownReport(docName, response);

    try {
      const reportFile = await this.createUniqueVaultFile(reportFileName, markdownReport);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(reportFile);
      new Notice(`Exported compliance audit report to "${reportFile.name}".`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`Failed to export report: ${msg}`);
    }
  }

  private buildMarkdownReport(docName: string, response: LintenValidationResponse): string {
    const s = response.report?.scores || { overall: 100, structure: 100, links: 100, bestPractices: 100 };
    const spec = response.specialist?.metrics;
    const findings = response.report?.findings || [];
    const linkStats = response.linkStats;

    let md = `# Linten Specification Compliance Audit Report\n\n`;
    md += `> Audited Target: \`${docName}\`  \n`;
    md += `> Audit Date: ${new Date().toLocaleString()}  \n`;
    md += `> Platform: Obsidian Community Plugin  \n\n`;
    md += `## Overall Compliance Score: **${s.overall} / 100**\n\n`;

    md += `### Score Breakdown\n\n`;
    md += `| Category | Score | Status |\n`;
    md += `|---|---|---|\n`;
    md += `| Structural Syntax | ${s.structure}% | ${s.structure >= 90 ? 'Compliant' : 'Issues Found'} |\n`;
    md += `| Link Health & Reachability | ${s.links}% | ${s.links >= 90 ? 'Healthy' : 'Broken Links'} |\n`;
    md += `| Spec Best Practices | ${s.bestPractices}% | ${s.bestPractices >= 90 ? 'Optimal' : 'Needs Optimization'} |\n\n`;

    if (spec) {
      md += `### Context Window Utilization\n\n`;
      md += `- **Estimated Tokens**: ~${spec.estimatedTokens.toLocaleString()}\n`;
      md += `- **Word Count**: ${spec.wordCount.toLocaleString()} words\n`;
      md += `- **Google Gemini 2.0 (1M)**: ${((spec.estimatedTokens / 1000000) * 100).toFixed(2)}% of context window\n`;
      md += `- **Anthropic Claude 3.5 Sonnet (200k)**: ${((spec.estimatedTokens / 200000) * 100).toFixed(2)}% of context window\n`;
      md += `- **OpenAI GPT-4o (128k)**: ${((spec.estimatedTokens / 128000) * 100).toFixed(2)}% of context window\n`;
      md += `- **DeepSeek-V3 (64k)**: ${((spec.estimatedTokens / 64000) * 100).toFixed(2)}% of context window\n\n`;
    }

    if (linkStats) {
      md += `### Link Health Summary\n\n`;
      md += `- **Total Links Checked**: ${linkStats.total}\n`;
      md += `- **Reachable (200 OK)**: ${linkStats.ok}\n`;
      md += `- **Redirects (30x)**: ${linkStats.redirect}\n`;
      md += `- **Broken / Unreachable**: ${linkStats.broken}\n\n`;
    }

    md += `### Audit Findings & Recommendations (${findings.length})\n\n`;
    if (findings.length === 0) {
      md += `No structural defects detected. Specification conforms strictly to llms.txt standard.\n\n`;
    } else {
      for (const f of findings) {
        md += `#### [${f.severity.toUpperCase()}] ${f.title}\n`;
        if (f.detail) md += `${f.detail}\n\n`;
        if (f.recommendation) md += `> **Recommendation**: ${f.recommendation}\n\n`;
      }
    }

    md += `---\n*Generated by [Linten](https://linten.apps.loopstates.com) by [Loopstates](https://loopstates.com).*\n`;
    return md;
  }

  /**
   * Helper that creates a vault file, automatically deduplicating filenames to avoid collision errors.
   */
  async createUniqueVaultFile(basePath: string, content: string): Promise<TFile> {
    let targetPath = normalizePath(basePath);
    let counter = 1;

    const extMatch = targetPath.match(/(\.[^/.]+)$/);
    const ext = extMatch ? extMatch[1] : '';
    const nameWithoutExt = targetPath.replace(/(\.[^/.]+)$/, '');

    while (this.app.vault.getAbstractFileByPath(targetPath) !== null) {
      targetPath = normalizePath(`${nameWithoutExt} (${counter})${ext}`);
      counter++;
    }

    return await this.app.vault.create(targetPath, content);
  }

  formatMarkdown(raw: string): string {
    const lines = raw.split('\n');
    let title = '';
    let summary = '';
    let foundFirstH1 = false;
    let foundSummary = false;

    interface Section {
      title: string;
      items: string[];
    }
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip leading blank lines
      if (!trimmed && !foundFirstH1) continue;

      // 1. Detect First H1 Title
      if (!foundFirstH1 && /^#\s+(.+)$/.test(trimmed)) {
        title = trimmed.replace(/^#\s+/, '').trim();
        foundFirstH1 = true;
        continue;
      }

      // 2. Extra H1s are automatically demoted to H2 sections!
      if (foundFirstH1 && /^#\s+(.+)$/.test(trimmed)) {
        const secTitle = trimmed.replace(/^#\s+/, '').trim();
        currentSection = { title: secTitle, items: [] };
        sections.push(currentSection);
        continue;
      }

      // 3. Blockquote summary
      if (foundFirstH1 && !foundSummary && sections.length === 0 && /^>\s*(.+)$/.test(trimmed)) {
        summary = trimmed.replace(/^>\s*/, '').trim();
        foundSummary = true;
        continue;
      }

      // 4. H2 Section header
      if (/^##\s+(.+)$/.test(trimmed)) {
        const secTitle = trimmed.replace(/^##\s+/, '').trim();
        currentSection = { title: secTitle, items: [] };
        sections.push(currentSection);
        continue;
      }

      // 5. Standardize Markdown link items: - [Title](url): Description
      if (/^[-*+]\s+\[([^\]]+)\]\(([^)]+)\)(.*)$/.test(trimmed)) {
        const match = trimmed.match(/^[-*+]\s+\[([^\]]+)\]\(([^)]+)\)(.*)$/);
        if (match) {
          const anchor = match[1].trim();
          const url = match[2].trim();
          let desc = match[3].trim();
          if (desc.startsWith(':')) {
            desc = desc.substring(1).trim();
          }
          const formattedLink = desc ? `- [${anchor}](${url}): ${desc}` : `- [${anchor}](${url})`;
          if (!currentSection) {
            currentSection = { title: 'Documentation', items: [] };
            sections.push(currentSection);
          }
          currentSection.items.push(formattedLink);
          continue;
        }
      }

      // 6. Preserve other content (subheadings, paragraphs, notes)
      if (trimmed) {
        if (!currentSection) {
          if (!summary && foundFirstH1) {
            summary = trimmed;
            foundSummary = true;
          } else {
            currentSection = { title: 'Documentation', items: [] };
            sections.push(currentSection);
            currentSection.items.push(trimmed);
          }
        } else {
          currentSection.items.push(trimmed);
        }
      }
    }

    const output: string[] = [];
    output.push(`# ${title || 'Documentation'}`);
    output.push('');
    if (summary) {
      output.push(`> ${summary}`);
      output.push('');
    }
    if (sections.length === 0) {
      output.push('## Documentation');
      output.push('');
    } else {
      for (const sec of sections) {
        output.push(`## ${sec.title}`);
        output.push('');
        for (const item of sec.items) {
          output.push(item);
        }
        output.push('');
      }
    }
    return output.join('\n').trim() + '\n';
  }
}
