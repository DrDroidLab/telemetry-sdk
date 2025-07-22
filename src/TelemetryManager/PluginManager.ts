import type { TelemetryPlugin, Logger, TelemetryConfig } from "../types";
import { TelemetryState } from "./types";
import {
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
  PageViewPlugin,
  ErrorPlugin,
} from "../plugins";

export class PluginManager {
  private plugins: TelemetryPlugin[] = [];
  private customEventsPlugin?: CustomEventsPlugin;
  private logger: Logger;
  private state: TelemetryState;

  constructor(logger: Logger, state: TelemetryState) {
    this.logger = logger;
    this.state = state;
  }

  initializePlugins(config: TelemetryConfig): TelemetryPlugin[] {
    const pluginsToRegister: TelemetryPlugin[] = [];
    try {
      // Define plugin configurations
      const pluginConfigs = [
        {
          enabled: config.enablePageViews ?? true, // Enable page views by default
          plugin: PageViewPlugin,
          name: "PageViewPlugin",
        },
        {
          enabled: config.enableClicks,
          plugin: ClickPlugin,
          name: "ClickPlugin",
        },
        {
          enabled: config.enableLogs,
          plugin: LogPlugin,
          name: "LogPlugin",
        },
        {
          enabled: config.enableNetwork,
          plugin: NetworkPlugin,
          name: "NetworkPlugin",
        },
        {
          enabled: config.enablePerformance,
          plugin: PerformancePlugin,
          name: "PerformancePlugin",
        },
        {
          enabled: config.enableErrors ?? true, // Enable errors by default
          plugin: ErrorPlugin,
          name: "ErrorPlugin",
        },
        {
          enabled: config.enableCustomEvents,
          plugin: CustomEventsPlugin,
          name: "CustomEventsPlugin",
          isCustomEvents: true,
        },
      ];

      pluginConfigs.forEach(({ enabled, plugin, isCustomEvents }) => {
        if (enabled) {
          const pluginInstance = new plugin();
          if (
            typeof pluginInstance.isSupported === "function" &&
            !pluginInstance.isSupported?.()
          ) {
            // Skip plugins not supported in this environment
            return;
          }
          if (isCustomEvents) {
            this.customEventsPlugin = pluginInstance as CustomEventsPlugin;
          }
          pluginsToRegister.push(pluginInstance);
        }
      });

      this.logger.info("Plugin initialization completed", {
        totalPlugins: pluginsToRegister.length,
        enabledPlugins: pluginsToRegister.map(p => p.constructor.name),
      });
    } catch (error: unknown) {
      this.logger.error("Failed to initialize plugins", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return pluginsToRegister;
  }

  register(
    plugin: TelemetryPlugin,
    manager: {
      capture(event: {
        eventType: string;
        eventName: string;
        payload: Record<string, unknown>;
        timestamp: string;
      }): void;
    }
  ): void {
    try {
      this.validateState();
      this.plugins.push(plugin);
      plugin.initialize(manager);
      this.logger.debug("Plugin registered", {
        pluginName: plugin.constructor.name,
        totalPlugins: this.plugins.length,
      });
    } catch (error) {
      this.logger.error("Failed to register plugin", {
        pluginName: plugin.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      this.plugins.pop();
    }
  }

  private validateState(): void {
    if (
      this.state === TelemetryState.SHUTDOWN ||
      this.state === TelemetryState.SHUTTING_DOWN
    ) {
      throw new Error(
        `TelemetryManager is in ${this.state} state and cannot register plugins`
      );
    }
  }

  destroyAll(): void {
    for (const p of this.plugins) {
      try {
        if (p.destroy) {
          p.destroy();
        } else if (p.teardown) {
          p.teardown();
        }
        this.logger.debug("Plugin destroyed", {
          pluginName: p.constructor.name,
        });
      } catch (error) {
        this.logger.error("Plugin destruction failed", {
          pluginName: p.constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.plugins = [];
  }

  getCustomEventsPlugin(): CustomEventsPlugin | undefined {
    return this.customEventsPlugin;
  }

  getPlugins(): TelemetryPlugin[] {
    return [...this.plugins];
  }

  setState(state: TelemetryState): void {
    this.state = state;
  }
}
