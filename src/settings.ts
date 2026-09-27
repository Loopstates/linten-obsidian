import { App, PluginSettingTab, Setting } from 'obsidian';
import LintenPlugin from './main';

export interface LintenSettings {
  apiUrl: string;
  validateOnSave: boolean;
  probeLinks: boolean;
}

export const DEFAULT_SETTINGS: LintenSettings = {
  apiUrl: 'https://linten.apps.loopstates.com/api/v1',
  validateOnSave: false,
  probeLinks: true
};

export class LintenSettingTab extends PluginSettingTab {
  plugin: LintenPlugin;

  constructor(app: App, plugin: LintenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Configuration').setHeading();

    // Transparency Notice for Obsidian Community Compliance
    const noticeBox = containerEl.createDiv({ cls: 'linten-settings-notice' });
    noticeBox.createEl('p', {
      text: 'Privacy Notice: Linten connects to the Linten Cloud Middleware (linten.apps.loopstates.com) to execute live HTTP link reachability tests and spec parsing. Content is validated in memory and never stored.'
    });

    new Setting(containerEl)
      .setName('Linten API Endpoint')
      .setDesc('Cloud endpoint for validation and link probing.')
      .addText(text =>
        text
          .setPlaceholder('https://linten.apps.loopstates.com/api/v1')
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async value => {
            this.plugin.settings.apiUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Live Link Probing')
      .setDesc('Verify that every link in your llms.txt file is reachable (HTTP 200).')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.probeLinks)
          .onChange(async value => {
            this.plugin.settings.probeLinks = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Validate on Save')
      .setDesc('Automatically run validation whenever an llms.txt note is saved.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.validateOnSave)
          .onChange(async value => {
            this.plugin.settings.validateOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    // Loopstates Attribution Link
    const attribution = containerEl.createDiv({ cls: 'linten-settings-attribution' });
    attribution.createSpan({ text: 'A product by ' });
    const link = attribution.createEl('a', {
      text: 'Loopstates (loopstates.com)',
      href: 'https://loopstates.com'
    });
    link.setAttr('target', '_blank');
  }
}
