import { App, Modal, FuzzySuggestModal, Setting } from 'obsidian';
import { LintenValidationResponse, LintenCheckLinksResponse } from './apiClient';
import { TEMPLATES, IndustryTemplate } from './templates';
import { LINTEN_LOGO_SVG } from './logo';

export class LintenAuditModal extends Modal {
  private response: LintenValidationResponse;
  private fileName: string;
  private onAction?: (action: string) => void;

  constructor(
    app: App,
    fileName: string,
    response: LintenValidationResponse,
    onAction?: (action: string) => void
  ) {
    super(app);
    this.fileName = fileName;
    this.response = response;
    this.onAction = onAction;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('linten-modal-container');

    // 1. Sleek Modern Header with Authentic Linten Logo
    const headerEl = contentEl.createDiv({ cls: 'linten-modal-header' });
    const logoBadge = headerEl.createDiv({ cls: 'linten-logo-badge' });
    logoBadge.innerHTML = LINTEN_LOGO_SVG;

    const titleWrap = headerEl.createDiv({ cls: 'linten-title-wrap' });
    const titleRow = titleWrap.createDiv({ cls: 'linten-title-row' });
    titleRow.createEl('h2', { text: 'Linten Compliance Audit', cls: 'linten-modal-title' });
    titleRow.createSpan({ text: this.fileName, cls: 'linten-doc-badge' });
    titleWrap.createEl('p', {
      text: 'LLMs.txt Spec Validation & Structure Audit',
      cls: 'linten-modal-subtitle'
    });

    const report = this.response.report;
    const scores = report?.scores || { overall: 0, structure: 0, links: 0, bestPractices: 0 };
    const spec = this.response.specialist?.metrics;
    const parity = this.response.specialist?.dualFileParity;

    const scoreColor = scores.overall >= 90 ? '#10B981' : scores.overall >= 70 ? '#F59E0B' : '#EF4444';
    const scoreStatusClass = scores.overall >= 90 ? 'status-optimal' : scores.overall >= 70 ? 'status-warning' : 'status-error';

    // 2. High-Impact Primary Score Banner
    const scoreBanner = contentEl.createDiv({ cls: `linten-score-banner ${scoreStatusClass}` });
    scoreBanner.style.borderLeftColor = scoreColor;

    const scoreRing = scoreBanner.createDiv({ cls: 'linten-score-ring' });
    const scoreNum = scoreRing.createDiv({ text: `${scores.overall}`, cls: 'linten-score-num' });
    scoreNum.style.color = scoreColor;
    scoreRing.createSpan({ text: '/100', cls: 'linten-score-denom' });

    const scoreDesc = scoreBanner.createDiv({ cls: 'linten-score-desc' });
    const statusPill = scoreDesc.createSpan({ cls: `linten-status-pill ${scoreStatusClass}` });
    statusPill.setText(scores.overall >= 90 ? 'Spec Compliant' : scores.overall >= 70 ? 'Optimization Needed' : 'Critical Errors Detected');

    scoreDesc.createEl('p', {
      text: scores.overall >= 90 
        ? 'Your manifest complies with the official llms.txt standard and passes all structural checks.'
        : 'Review the structural diagnostics and link health below for your manifest.'
    });

    // 3. Sub-scores Grid with Visual Progress Meters
    const scoreGrid = contentEl.createDiv({ cls: 'linten-score-grid' });
    this.createScoreMeter(scoreGrid, 'Structure', scores.structure);
    this.createScoreMeter(scoreGrid, 'Link Health', scores.links);
    this.createScoreMeter(scoreGrid, 'Best Practices', scores.bestPractices);

    // 4. Specialist AI Metrics Bar
    if (spec) {
      const specBar = contentEl.createDiv({ cls: 'linten-spec-bar' });
      this.createSpecItem(specBar, 'Token Load', `~${spec.estimatedTokens.toLocaleString()} tok`, '#5271FF');
      this.createSpecItem(specBar, 'Word Count', `${spec.wordCount.toLocaleString()} words`);
      this.createSpecItem(specBar, 'Manifest Density', spec.tokenStatus?.toUpperCase() || 'OPTIMAL', '#10B981');
      if (parity) {
        this.createSpecItem(specBar, 'Companion Parity', parity.hasCompanion ? 'PRESENT' : 'MISSING', parity.hasCompanion ? '#10B981' : '#F59E0B');
      }
    }

    // 5. Hero Companion Warning Callout with Independent Button Below
    if (parity && !parity.hasCompanion) {
      const companionBox = contentEl.createDiv({ cls: 'linten-companion-hero' });
      const compContent = companionBox.createDiv({ cls: 'linten-companion-content' });
      compContent.createEl('strong', { text: 'Companion Manifest Missing (llms-full.txt)' });
      compContent.createEl('p', {
        text: 'An un-truncated llms-full.txt provides the complete documentation corpus alongside this manifest.'
      });

      if (this.onAction) {
        const actionRow = companionBox.createDiv({ cls: 'linten-companion-action' });
        const btn = actionRow.createEl('button', {
          cls: 'linten-btn-synthesize',
          text: 'Synthesize Companion llms-full.txt'
        });
        btn.addEventListener('click', () => {
          this.close();
          this.onAction?.('synthesize');
        });
      }
    }

    // 6. Findings & Diagnostics List
    contentEl.createEl('h3', { text: 'Audit Findings & Actionable Recommendations', cls: 'linten-findings-title' });
    const findingsList = contentEl.createDiv({ cls: 'linten-findings-list' });
    const findings = report?.findings || [];

    if (findings.length === 0) {
      const okItem = findingsList.createDiv({ cls: 'linten-finding-item linten-success' });
      okItem.createSpan({ text: 'All structural requirements passed with zero errors. Specification conforms strictly to llms.txt standard.' });
    } else {
      for (const f of findings) {
        const severity = f.severity === 'error' ? 'linten-error' : f.severity === 'warning' ? 'linten-warning' : 'linten-success';
        const item = findingsList.createDiv({ cls: `linten-finding-item ${severity}` });
        
        const headRow = item.createDiv({ cls: 'linten-finding-head-row' });
        headRow.createSpan({ cls: `linten-sev-badge ${severity}`, text: f.severity.toUpperCase() });
        headRow.createSpan({ cls: 'linten-finding-head', text: f.title || 'Diagnostic Finding' });

        if (f.detail) {
          // If detail contains URLs (e.g. broken links), format them as structured pills
          const urls = f.detail.match(/https?:\/\/[^\s,]+/g);
          if (urls && urls.length > 0) {
            const detailText = f.detail.replace(/https?:\/\/[^\s,]+(,\s*)?/g, '').trim();
            if (detailText) {
              item.createDiv({ cls: 'linten-finding-body', text: detailText });
            }
            const urlContainer = item.createDiv({ cls: 'linten-url-chip-container' });
            for (const u of urls) {
              const chip = urlContainer.createDiv({ cls: 'linten-url-chip' });
              chip.createSpan({ cls: 'linten-chip-badge', text: '404 BROKEN' });
              const urlLink = chip.createEl('a', { text: u, href: u });
              urlLink.setAttr('target', '_blank');
            }
          } else {
            item.createDiv({ cls: 'linten-finding-body', text: f.detail });
          }
        }

        if (f.recommendation) {
          const recBox = item.createDiv({ cls: 'linten-finding-recommendation' });
          recBox.createSpan({ cls: 'linten-rec-label', text: 'Recommendation: ' });
          recBox.createSpan({ text: f.recommendation });
        }
      }
    }

    // 7. Action Bar
    if (this.onAction) {
      const actionsBar = contentEl.createDiv({ cls: 'linten-modal-actions' });
      
      const btnSynthesize = actionsBar.createEl('button', { cls: 'linten-action-btn mod-cta' });
      btnSynthesize.setText('Synthesize Companion');
      btnSynthesize.addEventListener('click', () => {
        this.close();
        this.onAction?.('synthesize');
      });

      const btnLinks = actionsBar.createEl('button', {
        cls: `linten-action-btn ${scores.links < 100 ? 'mod-warning' : ''}`
      });
      const brokenCount = findings.filter(f => f.category === 'links' || f.title?.toLowerCase().includes('broken')).length;
      btnLinks.setText(brokenCount > 0 ? `Audit Links (${brokenCount} Broken)` : 'Audit Links');
      btnLinks.addEventListener('click', () => {
        this.close();
        this.onAction?.('audit-links');
      });

      const btnBudget = actionsBar.createEl('button', { cls: 'linten-action-btn' });
      btnBudget.setText('Context Budget');
      btnBudget.addEventListener('click', () => {
        this.close();
        this.onAction?.('budget');
      });

      const btnFormat = actionsBar.createEl('button', { cls: 'linten-action-btn' });
      btnFormat.setText('Auto-Format');
      btnFormat.addEventListener('click', () => {
        this.close();
        this.onAction?.('format');
      });

      const btnExport = actionsBar.createEl('button', { cls: 'linten-action-btn' });
      btnExport.setText('Export Report');
      btnExport.addEventListener('click', () => {
        this.close();
        this.onAction?.('export');
      });

      const btnBadge = actionsBar.createEl('button', { cls: 'linten-action-btn' });
      btnBadge.setText('Get Badge');
      btnBadge.addEventListener('click', () => {
        this.close();
        this.onAction?.('badge');
      });
    }

    // 8. Modal Footer
    const footer = contentEl.createDiv({ cls: 'linten-modal-footer' });
    const footerLink = footer.createEl('a', {
      text: 'Engineered by Loopstates (loopstates.com)',
      href: 'https://loopstates.com'
    });
    footerLink.setAttr('target', '_blank');
  }

  private createScoreMeter(container: HTMLElement, label: string, val: number) {
    const box = container.createDiv({ cls: 'linten-subscore-box' });
    const numColor = val >= 90 ? '#10B981' : val >= 70 ? '#F59E0B' : '#EF4444';
    
    const num = box.createDiv({ text: `${val}%`, cls: 'linten-subscore-num' });
    num.style.color = numColor;

    box.createDiv({ text: label, cls: 'linten-subscore-label' });

    const meter = box.createDiv({ cls: 'linten-meter-track' });
    const fill = meter.createDiv({ cls: 'linten-meter-fill' });
    fill.style.width = `${Math.max(4, Math.min(100, val))}%`;
    fill.style.backgroundColor = numColor;
  }

  private createSpecItem(container: HTMLElement, label: string, val: string, color?: string) {
    const item = container.createDiv({ cls: 'linten-spec-item' });
    item.createSpan({ text: label, cls: 'linten-spec-label' });
    const valEl = item.createSpan({ text: val, cls: 'linten-spec-val' });
    if (color) valEl.style.color = color;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class LintenLinkAuditModal extends Modal {
  private report: LintenCheckLinksResponse;
  private fileName: string;

  constructor(app: App, fileName: string, report: LintenCheckLinksResponse) {
    super(app);
    this.fileName = fileName;
    this.report = report;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('linten-modal-container');

    const headerEl = contentEl.createDiv({ cls: 'linten-modal-header' });
    const logoBadge = headerEl.createDiv({ cls: 'linten-logo-badge' });
    logoBadge.innerHTML = LINTEN_LOGO_SVG;

    const titleWrap = headerEl.createDiv({ cls: 'linten-title-wrap' });
    const titleRow = titleWrap.createDiv({ cls: 'linten-title-row' });
    titleRow.createEl('h2', { text: 'Link Health Audit', cls: 'linten-modal-title' });
    titleRow.createSpan({ text: this.fileName, cls: 'linten-doc-badge' });
    titleWrap.createEl('p', {
      text: 'Concurrent 100-link reachability probe verifying public endpoints and redirect chains',
      cls: 'linten-modal-subtitle'
    });

    const scoreColor = this.report.healthScore >= 90 ? '#10B981' : this.report.healthScore >= 70 ? '#F59E0B' : '#EF4444';
    const banner = contentEl.createDiv({ cls: 'linten-score-banner' });
    banner.style.borderLeftColor = scoreColor;

    const scoreRing = banner.createDiv({ cls: 'linten-score-ring' });
    const scoreNum = scoreRing.createDiv({ text: `${this.report.healthScore}`, cls: 'linten-score-num' });
    scoreNum.style.color = scoreColor;
    scoreRing.createSpan({ text: '/100', cls: 'linten-score-denom' });

    const desc = banner.createDiv({ cls: 'linten-score-desc' });
    const statusPill = desc.createSpan({ cls: `linten-status-pill ${this.report.healthScore >= 90 ? 'status-optimal' : 'status-warning'}` });
    statusPill.setText(this.report.healthScore >= 90 ? 'High Link Reliability' : 'Broken Links or Redirects Detected');

    desc.createEl('p', {
      text: `Probed ${this.report.totalAudited} links (${this.report.summary.okCount} OK, ${this.report.summary.redirectCount} redirects, ${this.report.summary.brokenCount} broken, ${this.report.summary.timeoutCount} timeouts).`
    });

    // Score Grid
    const grid = contentEl.createDiv({ cls: 'linten-score-grid' });
    this.createBox(grid, 'Reachable (200)', `${this.report.summary.okCount}`, '#10B981');
    this.createBox(grid, 'Redirects (30x)', `${this.report.summary.redirectCount}`, '#F59E0B');
    this.createBox(grid, 'Broken / Timeout', `${this.report.summary.brokenCount + this.report.summary.timeoutCount}`, '#EF4444');

    // Link List
    contentEl.createEl('h3', { text: 'Probed URL Reachability Details', cls: 'linten-findings-title' });
    const list = contentEl.createDiv({ cls: 'linten-findings-list' });

    for (const item of this.report.results) {
      const cls = item.statusType === 'ok' ? 'linten-success' : item.statusType === 'redirect' ? 'linten-warning' : 'linten-error';
      const row = list.createDiv({ cls: `linten-finding-item ${cls}` });
      
      const head = row.createDiv({ cls: 'linten-finding-head-row' });
      head.createSpan({ cls: `linten-sev-badge ${cls}`, text: item.statusType.toUpperCase() });
      head.createSpan({ text: `${item.statusCode || 'ERR'} (${item.latencyMs}ms) — ${item.title}` });

      const body = row.createDiv({ cls: 'linten-finding-body' });
      const linkEl = body.createEl('a', { text: item.url, href: item.url });
      linkEl.setAttr('target', '_blank');

      if (item.isRedirect && item.finalUrl) {
        body.createDiv({ text: `↳ Redirects to canonical: ${item.finalUrl}`, cls: 'linten-redirect-notice' });
      }
    }

    const footer = contentEl.createDiv({ cls: 'linten-modal-footer' });
    const link = footer.createEl('a', { text: 'Engineered by Loopstates', href: 'https://loopstates.com' });
    link.setAttr('target', '_blank');
  }

  private createBox(container: HTMLElement, label: string, val: string, color?: string) {
    const box = container.createDiv({ cls: 'linten-subscore-box' });
    const num = box.createDiv({ text: val, cls: 'linten-subscore-num' });
    if (color) num.style.color = color;
    box.createDiv({ text: label, cls: 'linten-subscore-label' });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class LintenBudgetModal extends Modal {
  private noteContent: string;
  private fileName: string;

  constructor(app: App, fileName: string, noteContent: string) {
    super(app);
    this.fileName = fileName;
    this.noteContent = noteContent;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('linten-modal-container');

    const headerEl = contentEl.createDiv({ cls: 'linten-modal-header' });
    const logoBadge = headerEl.createDiv({ cls: 'linten-logo-badge' });
    logoBadge.innerHTML = LINTEN_LOGO_SVG;

    const titleWrap = headerEl.createDiv({ cls: 'linten-title-wrap' });
    const titleRow = titleWrap.createDiv({ cls: 'linten-title-row' });
    titleRow.createEl('h2', { text: 'Context Window Budget', cls: 'linten-modal-title' });
    titleRow.createSpan({ text: this.fileName, cls: 'linten-doc-badge' });
    titleWrap.createEl('p', {
      text: 'Token utilization benchmarks across major language model context windows',
      cls: 'linten-modal-subtitle'
    });

    const chars = this.noteContent.length;
    const words = this.noteContent.trim().split(/\s+/).filter(Boolean).length;
    const estimatedTokens = Math.max(1, Math.round(chars / 4));

    const specBar = contentEl.createDiv({ cls: 'linten-spec-bar' });
    const createItem = (lbl: string, val: string, col?: string) => {
      const item = specBar.createDiv({ cls: 'linten-spec-item' });
      item.createSpan({ text: lbl, cls: 'linten-spec-label' });
      const v = item.createSpan({ text: val, cls: 'linten-spec-val' });
      if (col) v.style.color = col;
    };
    createItem('Estimated Tokens', `~${estimatedTokens.toLocaleString()}`, '#5271FF');
    createItem('Word Count', words.toLocaleString());
    createItem('Character Count', chars.toLocaleString());

    contentEl.createEl('h3', { text: 'Model Capacity Gauges', cls: 'linten-findings-title' });
    const list = contentEl.createDiv({ cls: 'linten-findings-list' });

    const models = [
      { name: 'Google Gemini 2.0 (Flash / Pro)', window: 1000000, desc: 'Ultra-long 1M token context window' },
      { name: 'Anthropic Claude 3.5 Sonnet', window: 200000, desc: '200k high-reasoning context' },
      { name: 'OpenAI GPT-4o', window: 128000, desc: '128k multimodal reasoning window' },
      { name: 'DeepSeek-V3', window: 64000, desc: '64k cost-effective window' }
    ];

    for (const m of models) {
      const pct = (estimatedTokens / m.window) * 100;
      const isSafe = estimatedTokens <= m.window;
      const item = list.createDiv({ cls: `linten-finding-item ${isSafe ? 'linten-success' : 'linten-error'}` });
      
      const head = item.createDiv({ cls: 'linten-finding-head-row' });
      head.createSpan({ text: m.name, cls: 'linten-finding-head' });
      head.createSpan({
        text: `${pct < 0.01 ? '< 0.01' : pct.toFixed(2)}% used`,
        cls: `linten-sev-badge ${isSafe ? 'linten-success' : 'linten-error'}`
      });

      const body = item.createDiv({ cls: 'linten-finding-body' });
      body.setText(`${estimatedTokens.toLocaleString()} / ${m.window.toLocaleString()} tokens capacity (${m.desc}).`);

      const meter = item.createDiv({ cls: 'linten-meter-track' });
      const fill = meter.createDiv({ cls: 'linten-meter-fill' });
      fill.style.width = `${Math.max(2, Math.min(100, pct))}%`;
      fill.style.backgroundColor = isSafe ? '#10B981' : '#EF4444';
    }

    const tip = contentEl.createDiv({ cls: 'linten-finding-item linten-tip-box' });
    tip.createDiv({
      cls: 'linten-finding-body',
      text: 'Tip: Spec v2 recommends keeping root llms.txt under 10,000 tokens for zero-cache latency across reasoning agents.'
    });

    const footer = contentEl.createDiv({ cls: 'linten-modal-footer' });
    const link = footer.createEl('a', { text: 'Engineered by Loopstates', href: 'https://loopstates.com' });
    link.setAttr('target', '_blank');
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class LintenTemplateModal extends FuzzySuggestModal<IndustryTemplate> {
  private onSelect: (template: IndustryTemplate) => void;

  constructor(app: App, onSelect: (template: IndustryTemplate) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder('Search 30 spec v2 industry starter presets (e.g. SaaS, API, E-commerce, Notion)...');
  }

  getItems(): IndustryTemplate[] {
    return Object.values(TEMPLATES);
  }

  getItemText(item: IndustryTemplate): string {
    return `${item.name} (${item.id}) - ${item.description}`;
  }

  onChooseItem(item: IndustryTemplate): void {
    this.onSelect(item);
  }
}

/**
 * Mobile-safe, zero-block dialog replacing window.prompt
 */
export class LintenPromptModal extends Modal {
  private titleText: string;
  private placeholder: string;
  private initialValue: string;
  private submitLabel: string;
  private onSubmit: (value: string) => void;

  constructor(
    app: App,
    title: string,
    placeholder: string,
    initialValue: string,
    submitLabel: string,
    onSubmit: (value: string) => void
  ) {
    super(app);
    this.titleText = title;
    this.placeholder = placeholder;
    this.initialValue = initialValue;
    this.submitLabel = submitLabel;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('linten-modal-container');

    const headerEl = contentEl.createDiv({ cls: 'linten-modal-header' });
    const logoBadge = headerEl.createDiv({ cls: 'linten-logo-badge' });
    logoBadge.innerHTML = LINTEN_LOGO_SVG;

    const titleWrap = headerEl.createDiv({ cls: 'linten-title-wrap' });
    titleWrap.createEl('h2', { text: this.titleText, cls: 'linten-modal-title' });

    let inputValue = this.initialValue;

    new Setting(contentEl)
      .setName('Target Website or Domain')
      .setDesc('Enter a domain name or URL (e.g. stripe.com or loopstates.com)')
      .addText(text => {
        text.setPlaceholder(this.placeholder);
        text.setValue(this.initialValue);
        text.onChange(val => {
          inputValue = val;
        });
        text.inputEl.focus();
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.close();
            this.onSubmit(inputValue.trim());
          }
        });
      });

    const actions = contentEl.createDiv({ cls: 'linten-modal-actions' });
    const submitBtn = actions.createEl('button', { text: this.submitLabel, cls: 'linten-action-btn mod-cta' });
    submitBtn.addEventListener('click', () => {
      this.close();
      this.onSubmit(inputValue.trim());
    });

    const cancelBtn = actions.createEl('button', { text: 'Cancel', cls: 'linten-action-btn' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Dynamic README / Note compliance badge generator modal
 */
export class LintenBadgeModal extends Modal {
  private domain: string;
  private onInsertNote?: (snippet: string) => void;

  constructor(app: App, domain: string, onInsertNote?: (snippet: string) => void) {
    super(app);
    this.domain = domain;
    this.onInsertNote = onInsertNote;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('linten-modal-container');

    const headerEl = contentEl.createDiv({ cls: 'linten-modal-header' });
    const logoBadge = headerEl.createDiv({ cls: 'linten-logo-badge' });
    logoBadge.innerHTML = LINTEN_LOGO_SVG;

    const titleWrap = headerEl.createDiv({ cls: 'linten-title-wrap' });
    titleWrap.createEl('h2', { text: 'Linten Compliance Badge', cls: 'linten-modal-title' });

    const cleanDomain = this.domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim() || 'loopstates.com';
    const badgeUrl = `https://linten.apps.loopstates.com/badge?domain=${encodeURIComponent(cleanDomain)}`;
    const mdSnippet = `[![Linten Spec Validated](${badgeUrl})](https://${cleanDomain})`;
    const htmlSnippet = `<a href="https://${cleanDomain}"><img src="${badgeUrl}" alt="Linten Spec Validated" /></a>`;

    const desc = contentEl.createDiv({ cls: 'linten-badge-desc' });
    desc.createEl('p', {
      text: 'Dynamic SVG badge that automatically validates your live /llms.txt AST score on every load.'
    });

    const previewBox = contentEl.createDiv({ cls: 'linten-badge-preview' });
    previewBox.createEl('img', { attr: { src: badgeUrl, alt: 'Linten Badge Preview' } });

    const snippetBox = contentEl.createDiv({ cls: 'linten-finding-item' });
    snippetBox.createDiv({ cls: 'linten-finding-head', text: 'Markdown Badge Code:' });
    const codeEl = snippetBox.createEl('code', { text: mdSnippet });
    codeEl.style.fontSize = '0.78rem';

    const actions = contentEl.createDiv({ cls: 'linten-modal-actions' });

    const btnCopyMd = actions.createEl('button', { text: 'Copy Markdown', cls: 'linten-action-btn mod-cta' });
    btnCopyMd.addEventListener('click', async () => {
      await navigator.clipboard.writeText(mdSnippet);
      this.close();
    });

    if (this.onInsertNote) {
      const btnInsert = actions.createEl('button', { text: 'Insert into Active Note', cls: 'linten-action-btn' });
      btnInsert.addEventListener('click', () => {
        this.close();
        this.onInsertNote?.(mdSnippet);
      });
    }

    const btnCopyHtml = actions.createEl('button', { text: 'Copy HTML', cls: 'linten-action-btn' });
    btnCopyHtml.addEventListener('click', async () => {
      await navigator.clipboard.writeText(htmlSnippet);
      this.close();
    });

    const btnCopySvg = actions.createEl('button', { text: 'Copy SVG URL', cls: 'linten-action-btn' });
    btnCopySvg.addEventListener('click', async () => {
      await navigator.clipboard.writeText(badgeUrl);
      this.close();
    });

    const footer = contentEl.createDiv({ cls: 'linten-modal-footer' });
    const link = footer.createEl('a', { text: 'Engineered by Loopstates', href: 'https://loopstates.com' });
    link.setAttr('target', '_blank');
  }

  onClose() {
    this.contentEl.empty();
  }
}
