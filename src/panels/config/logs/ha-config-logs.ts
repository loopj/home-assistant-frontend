import {
  mdiChevronDown,
  mdiChip,
  mdiDns,
  mdiPackageVariant,
  mdiPuzzle,
  mdiRadar,
  mdiVolumeHigh,
} from "@mdi/js";
import type { CSSResultGroup, TemplateResult, PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { isComponentLoaded } from "../../../common/config/is_component_loaded";
import { atLeastVersion } from "../../../common/config/version";
import { QueryParamsController } from "../../../common/controllers/query-params-controller";
import type { HASSDomTargetEvent } from "../../../common/dom/fire_event";
import { navigate } from "../../../common/navigate";
import { stringCompare } from "../../../common/string/compare";
import { currentPath } from "../../../common/url/current-path";
import {
  DEFAULT_LOG_PROVIDER,
  logProviderFromUrl,
  logRawFromUrl,
  logSearchFromUrl,
  logsQueryParamConfig,
  logsQueryParamsFromState,
} from "../../../common/url/logs-query-params";
import { createQueryString } from "../../../common/url/query-params";
import "../../../components/ha-app-icon";
import "../../../components/ha-button";
import "../../../components/ha-generic-picker";
import type { HaGenericPicker } from "../../../components/ha-generic-picker";
import type { PickerComboBoxItem } from "../../../components/ha-picker-combo-box";
import "../../../components/input/ha-input-search";
import type { HaInputSearch } from "../../../components/input/ha-input-search";
import type { LogProvider } from "../../../data/error_log";
import {
  fetchHassioAddonsInfo,
  type HassioAddonInfo,
} from "../../../data/hassio/addon";
import { showAlertDialog } from "../../../dialogs/generic/show-dialog-box";
import "../../../layouts/hass-subpage";
import { mdiHomeAssistant } from "../../../resources/home-assistant-logo-svg";
import { haStyle } from "../../../resources/styles";
import type { HomeAssistant, Route, ValueChangedEvent } from "../../../types";
import "./error-log-card";
import "./system-log-card";
import type { SystemLogCard } from "./system-log-card";

const logProviders: LogProvider[] = [
  {
    key: "core",
    name: "Home Assistant Core",
  },
  {
    key: "supervisor",
    name: "Supervisor",
  },
  {
    key: "host",
    name: "Host",
  },
  {
    key: "dns",
    name: "DNS",
  },
  {
    key: "audio",
    name: "Audio",
  },
  {
    key: "multicast",
    name: "Multicast",
  },
];

interface LogProviderPickerItem extends PickerComboBoxItem {
  addon?: HassioAddonInfo;
  hasAppIcon?: boolean;
}

@customElement("ha-config-logs")
export class HaConfigLogs extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean }) public narrow = false;

  @property({ attribute: "is-wide", type: Boolean }) public isWide = false;

  @property({ attribute: false }) public route!: Route;

  @state() private _filter = "";

  @state() private _detail = false;

  @query("system-log-card") private systemLog?: SystemLogCard;

  @query("ha-generic-picker") private providerPicker?: HaGenericPicker;

  @state() private _selectedLogProvider = DEFAULT_LOG_PROVIDER;

  @state() private _logProviders = logProviders;

  // The provider in the URL is only checked once the apps are loaded
  private _providersLoaded = false;

  private _queryParams = new QueryParamsController(this, logsQueryParamConfig, {
    enabled: () => true,
    navigated: () => this._applyUrl(),
  });

  public connectedCallback() {
    super.connectedCallback();
    const systemLog = this.systemLog;
    if (systemLog && systemLog.loaded) {
      systemLog.fetchData();
    }
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    if (!this.hasUpdated) {
      this._applyUrl();
    }
  }

  protected firstUpdated(changedProps: PropertyValues<this>): void {
    super.firstUpdated(changedProps);
    this._init();
  }

  private _filterChanged(ev: HASSDomTargetEvent<HaInputSearch>) {
    this._filter = ev.target.value ?? "";
    this._writeUrl(true);
  }

  private _flushUrl() {
    this._queryParams.flush();
  }

  protected render(): TemplateResult {
    const search = html`
      <div class="search">
        <ha-input-search
          appearance="outlined"
          @input=${this._filterChanged}
          @blur=${this._flushUrl}
          .value=${this._filter}
          .placeholder=${this.hass.localize("ui.panel.config.logs.search")}
        ></ha-input-search>
      </div>
    `;

    const selectedProvider = this._getActiveProvider(this._selectedLogProvider);

    return html`
      <hass-subpage
        .hass=${this.hass}
        .narrow=${this.narrow}
        .header=${this.hass.localize("ui.panel.config.logs.caption")}
        back-path="/config/system"
      >
        ${
          isComponentLoaded(this.hass.config, "hassio") && this._logProviders
            ? html`
                <ha-generic-picker
                  slot="toolbar-icon"
                  .getItems=${this._getLogProviderItems}
                  value=""
                  .rowRenderer=${this._providerRenderer}
                  @value-changed=${this._handleDropdownSelect}
                >
                  <ha-button
                    slot="field"
                    appearance="filled"
                    @click=${this._openPicker}
                  >
                    ${
                      selectedProvider
                        ? this._renderProviderIcon(selectedProvider)
                        : nothing
                    }
                    ${selectedProvider?.primary}
                    <ha-svg-icon
                      slot="end"
                      .path=${mdiChevronDown}
                    ></ha-svg-icon>
                  </ha-button>
                </ha-generic-picker>
              `
            : nothing
        }
        ${search}
        <div class="content">
          ${
            this._selectedLogProvider === "core" && !this._detail
              ? html`
                  <system-log-card
                    .hass=${this.hass}
                    .header=${
                      this._logProviders.find(
                        (p) => p.key === this._selectedLogProvider
                      )!.name
                    }
                    .filter=${this._filter}
                    @switch-log-view=${this._showDetail}
                  ></system-log-card>
                `
              : html`<error-log-card
                  .header=${
                    this._logProviders.find(
                      (p) => p.key === this._selectedLogProvider
                    )!.name
                  }
                  .filter=${this._filter}
                  .provider=${this._selectedLogProvider}
                  @switch-log-view=${this._showDetail}
                  allow-switch
                ></error-log-card>`
          }
        </div>
      </hass-subpage>
    `;
  }

  private _showDetail() {
    this._detail = !this._detail;
    this._writeUrl();
  }

  private _openPicker(ev: Event) {
    ev.stopPropagation();
    this.providerPicker?.open();
  }

  private _handleDropdownSelect(ev: ValueChangedEvent<string>) {
    const provider = ev.detail?.value;
    if (!provider) {
      return;
    }

    // Keep the search typed so far on the entry Back returns to
    this._queryParams.flush();

    // A new provider is a new history entry, without the search
    const queryString = createQueryString(
      logsQueryParamsFromState(provider, ""),
      logsQueryParamConfig
    );

    // From the current path, so a trailing slash still matches the controller
    navigate(`${currentPath()}${queryString ? `?${queryString}` : ""}`);
  }

  private async _init() {
    if (isComponentLoaded(this.hass.config, "hassio")) {
      await this._getInstalledAddons();
    }

    // Keep a search typed while the apps were loading
    this._queryParams.flush();
    this._providersLoaded = true;
    this._applyUrl();
  }

  // The URL is the state of the page: no provider is Core, no search is none
  // and no raw is Core's condensed view
  private _applyUrl() {
    const searchParams = this._queryParams.searchParams();

    if (!searchParams) {
      return;
    }

    this._filter = logSearchFromUrl(searchParams);
    this._detail = logRawFromUrl(searchParams);

    if (!this._providersLoaded) {
      return;
    }

    const provider = logProviderFromUrl(searchParams);

    const providerFound =
      provider === DEFAULT_LOG_PROVIDER ||
      (isComponentLoaded(this.hass.config, "hassio") &&
        this._logProviders.some((p) => p.key === provider));

    this._selectedLogProvider = providerFound ? provider : DEFAULT_LOG_PROVIDER;

    // Before the alert adds its history entry, so closing it doesn't go back
    // to the missing provider
    this._writeUrl();

    if (!providerFound) {
      showAlertDialog(this, {
        title:
          this.hass.localize("ui.panel.config.logs.provider_not_found") ||
          "Log provider not found",
        text: this.hass.localize(
          "ui.panel.config.logs.provider_not_available",
          {
            provider:
              this._logProviders.find((p) => p.key === provider)?.name ||
              provider,
          }
        ),
      });
    }
  }

  private _writeUrl(debounced = false) {
    // Until the apps are loaded, keep the provider the URL asks for
    const provider = this._providersLoaded
      ? this._selectedLogProvider
      : logProviderFromUrl(this._queryParams.searchParams() ?? "");

    this._queryParams.write(
      logsQueryParamsFromState(provider, this._filter, this._detail),
      debounced
    );
  }

  private async _getInstalledAddons() {
    try {
      const addonsInfo = await fetchHassioAddonsInfo(this.hass);
      const sortedAddons = addonsInfo.addons
        .filter((addon) => addon.version)
        .map((addon) => ({
          key: addon.slug,
          name: addon.name,
          addon,
        }))
        .sort((a, b) =>
          stringCompare(a.name, b.name, this.hass.locale.language)
        );

      this._logProviders = [...this._logProviders, ...sortedAddons];
    } catch (_err) {
      // Ignore, nothing the user can do anyway
    }
  }

  private _getLogProviderItems = (): LogProviderPickerItem[] =>
    this._logProviders.map((provider) => ({
      id: provider.key,
      primary: provider.name,
      addon: provider.addon,
      hasAppIcon: provider.addon
        ? atLeastVersion(this.hass.config.version, 0, 105) &&
          provider.addon.icon
        : undefined,
      icon_path: provider.addon
        ? mdiPuzzle
        : this._getProviderIconPath(provider.key),
    }));

  private _renderProviderIcon(item: LogProviderPickerItem) {
    if (item.addon) {
      return html`<ha-app-icon
        slot="start"
        .alt=${item.primary}
        .hasIcon=${item.hasAppIcon}
        .slug=${item.addon.slug}
      >
        <ha-svg-icon .path=${item.icon_path}></ha-svg-icon>
      </ha-app-icon>`;
    }

    return item.icon_path
      ? html`<ha-svg-icon slot="start" .path=${item.icon_path}></ha-svg-icon>`
      : nothing;
  }

  private _providerRenderer = (item: LogProviderPickerItem) => html`
    <ha-combo-box-item>
      ${this._renderProviderIcon(item)}
      <span slot="headline">${item.primary}</span>
      ${
        item.secondary
          ? html`<span slot="supporting-text">${item.secondary}</span>`
          : nothing
      }
    </ha-combo-box-item>
  `;

  private _getActiveProvider = memoizeOne((selectedLogProvider: string) => {
    const provider = this._logProviders.find(
      (p) => p.key === selectedLogProvider
    );
    if (provider) {
      return {
        id: provider.key,
        primary: provider.name,
        addon: provider.addon,
        hasAppIcon: provider.addon
          ? atLeastVersion(this.hass.config.version, 0, 105) &&
            provider.addon.icon
          : undefined,
        icon_path: provider.addon
          ? mdiPuzzle
          : this._getProviderIconPath(provider.key),
      };
    }
    return undefined;
  });

  private _getProviderIconPath(providerKey: string): string | undefined {
    switch (providerKey) {
      case "core":
        return mdiHomeAssistant;
      case "supervisor":
        return mdiPackageVariant;
      case "host":
        return mdiChip;
      case "dns":
        return mdiDns;
      case "audio":
        return mdiVolumeHigh;
      case "multicast":
        return mdiRadar;
    }
    return undefined;
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        :host {
          user-select: initial;
        }
        .search {
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .search ha-input-search {
          padding: var(--ha-space-3);
          background: var(--sidebar-background-color);
          border-bottom: 1px solid var(--divider-color);
        }
        .content {
          direction: ltr;
        }
        ha-generic-picker {
          --ha-combo-box-item-start-color: var(--ha-color-primary-50);
          --mdc-icon-size: var(--ha-space-6);
        }

        ha-app-icon {
          --ha-app-icon-size: 32px;
        }

        @media all and (max-width: 870px) {
          ha-generic-picker {
            max-width: max(30%, 180px);
          }
          ha-button {
            max-width: 100%;
          }
          ha-button::part(label) {
            overflow: hidden;
            white-space: nowrap;
          }
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-logs": HaConfigLogs;
  }
}
