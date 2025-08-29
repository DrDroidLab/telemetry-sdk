import { record } from "rrweb";
import { BasePlugin } from "../BasePlugin";
import type {
  SessionReplayEvent,
  SessionReplayPayload,
  SessionReplayConfig,
  SessionReplayState,
  SessionReplayMetadata,
} from "../../types/SessionReplay";
import { generateSessionId } from "../../TelemetryManager/utils/generateSessionId";

// Define a basic event type to avoid rrweb type issues
type BasicEvent = {
  type: number;
  data: unknown;
  timestamp: number;
};

export class SessionReplayPlugin extends BasePlugin {
  private stopFn: (() => void) | null = null;
  private events: BasicEvent[] = [];
  private state: SessionReplayState = {
    isRecording: false,
    isPaused: false,
    startTime: 0,
    eventCount: 0,
    lastEventTime: 0,
  };
  private config: SessionReplayConfig;
  private sessionId: string;
  private maxEvents: number;
  private maxDuration: number;
  private throttleTimer: NodeJS.Timeout | null = null;
  private lastThrottledEvent: BasicEvent | null = null;
  private batchEvents: BasicEvent[] = [];
  private batchSize: number = 50; // Batch events for export
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.sessionId = generateSessionId();
    this.config = {};
    this.maxEvents = 10000; // Default max events
    this.maxDuration = 30 * 60 * 1000; // 30 minutes default

    this.logger.info("SessionReplayPlugin constructor called", {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  public isSupported(): boolean {
    const supported =
      typeof window !== "undefined" && typeof document !== "undefined";
    this.logger.info("SessionReplayPlugin isSupported check", {
      supported,
      hasWindow: typeof window !== "undefined",
      hasDocument: typeof document !== "undefined",
      sessionId: this.sessionId,
    });
    return supported;
  }

  protected setup(): void {
    this.logger.info("SessionReplayPlugin setup started", {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get configuration from telemetry manager
      this.config = this.manager.getConfig().sessionReplay || {};

      this.logger.info("SessionReplayPlugin configuration loaded", {
        sessionId: this.sessionId,
        config: this.config,
        hasManager: !!this.manager,
        managerConfig: this.manager?.getConfig(),
      });

      // Set limits from config
      this.maxEvents = this.config.maxEvents || 10000;
      this.maxDuration = this.config.maxDuration || 30 * 60 * 1000;
      this.batchSize = this.config.batchSize || 50;

      this.logger.info("SessionReplayPlugin limits configured", {
        sessionId: this.sessionId,
        maxEvents: this.maxEvents,
        maxDuration: this.maxDuration,
        batchSize: this.batchSize,
      });

      // Start recording
      this.startRecording();

      this.logger.info("SessionReplayPlugin setup completed successfully", {
        sessionId: this.sessionId,
        config: this.config,
        limits: {
          maxEvents: this.maxEvents,
          maxDuration: this.maxDuration,
          batchSize: this.batchSize,
        },
      });
    } catch (error) {
      this.logger.error("SessionReplayPlugin setup failed", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.isEnabled = false;
    }
  }

  private startRecording(): void {
    this.logger.info("SessionReplayPlugin startRecording called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      timestamp: new Date().toISOString(),
    });

    if (this.state.isRecording) {
      this.logger.warn(
        "SessionReplayPlugin already recording, skipping start",
        {
          sessionId: this.sessionId,
        }
      );
      return;
    }

    try {
      this.state.isRecording = true;
      this.state.startTime = Date.now();
      this.events = [];
      this.batchEvents = [];

      this.logger.info("SessionReplayPlugin state initialized", {
        sessionId: this.sessionId,
        startTime: this.state.startTime,
        eventsArrayLength: this.events.length,
        batchEventsLength: this.batchEvents.length,
      });

      // Configure rrweb options
      const rrwebOptions: Record<string, unknown> = {
        recordCanvas: this.config.recordCanvas ?? false,
        recordCrossOriginIframes: this.config.recordCrossOriginIframes ?? false,
        recordAfter: this.config.recordAfter ?? "load",
        inlineStylesheet: this.config.inlineStylesheet ?? true,
        collectFonts: this.config.collectFonts ?? false,
        checkoutEveryNms: this.config.checkoutEveryNms ?? 5000,
        checkoutEveryNth: this.config.checkoutEveryNth ?? 500,
        blockClass: this.config.blockClass ?? "rr-block",
        ignoreClass: this.config.ignoreClass ?? "rr-ignore",
        maskTextClass: this.config.maskTextClass ?? "rr-mask",
        slimDOMOptions: this.config.slimDOMOptions ?? {
          script: true,
          comment: true,
          headFavicon: true,
          headWhitespace: true,
          headMetaDescKeywords: true,
          headMetaSocial: true,
          headMetaRobots: true,
          headMetaHttpEquiv: true,
          headMetaAuthorship: true,
          headMetaVerification: true,
        },
        emit: this.config.emit || this.handleRrwebEvent.bind(this),
      };

      // Add optional properties only if they exist
      if (this.config.blockSelector) {
        rrwebOptions.blockSelector = this.config.blockSelector;
      }
      if (this.config.maskTextSelector) {
        rrwebOptions.maskTextSelector = this.config.maskTextSelector;
      }

      this.logger.info("SessionReplayPlugin rrweb options configured", {
        sessionId: this.sessionId,
        rrwebOptions,
        hasCustomEmit: !!this.config.emit,
      });

      // Start rrweb recording
      this.logger.info("SessionReplayPlugin starting rrweb recording", {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      });

      const stopFn = record(rrwebOptions);
      this.stopFn = stopFn || null;

      this.logger.info("SessionReplayPlugin rrweb recording started", {
        sessionId: this.sessionId,
        hasStopFn: !!this.stopFn,
        timestamp: new Date().toISOString(),
      });

      // Send session start event
      this.sendSessionStartEvent();

      this.logger.info("SessionReplayPlugin recording started successfully", {
        sessionId: this.sessionId,
        options: rrwebOptions,
        startTime: this.state.startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.state.isRecording = false;
      this.logger.error("SessionReplayPlugin failed to start recording", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  private handleRrwebEvent(event: unknown): void {
    if (!this.state.isRecording || this.state.isPaused) {
      this.logger.debug(
        "SessionReplayPlugin ignoring rrweb event - not recording or paused",
        {
          sessionId: this.sessionId,
          isRecording: this.state.isRecording,
          isPaused: this.state.isPaused,
          eventType: (event as Record<string, unknown>)?.type,
        }
      );
      return;
    }

    try {
      // Type guard for event
      if (
        !event ||
        typeof event !== "object" ||
        !("type" in event) ||
        !("timestamp" in event)
      ) {
        this.logger.warn("SessionReplayPlugin received invalid rrweb event", {
          sessionId: this.sessionId,
          event,
          hasEvent: !!event,
          eventType: typeof event,
          hasType: event && typeof event === "object" && "type" in event,
          hasTimestamp:
            event && typeof event === "object" && "timestamp" in event,
        });
        return;
      }

      const eventObj = event as Record<string, unknown>;
      const basicEvent: BasicEvent = {
        type: Number(eventObj.type),
        data: eventObj.data || {},
        timestamp: Number(eventObj.timestamp),
      };

      this.logger.debug("SessionReplayPlugin processing rrweb event", {
        sessionId: this.sessionId,
        eventType: basicEvent.type,
        eventTimestamp: basicEvent.timestamp,
        eventDataKeys: Object.keys(
          (basicEvent.data as Record<string, unknown>) || {}
        ),
        currentEventCount: this.events.length,
        currentBatchCount: this.batchEvents.length,
      });

      // Check limits
      if (this.events.length >= this.maxEvents) {
        this.logger.warn(
          "SessionReplayPlugin event limit reached, stopping recording",
          {
            sessionId: this.sessionId,
            maxEvents: this.maxEvents,
            currentEvents: this.events.length,
            eventType: basicEvent.type,
          }
        );
        this.stopRecording();
        return;
      }

      const now = Date.now();
      if (now - this.state.startTime > this.maxDuration) {
        this.logger.warn(
          "SessionReplayPlugin duration limit reached, stopping recording",
          {
            sessionId: this.sessionId,
            maxDuration: this.maxDuration,
            currentDuration: now - this.state.startTime,
            eventType: basicEvent.type,
          }
        );
        this.stopRecording();
        return;
      }

      // Apply custom masking if configured
      const maskedEvent = this.applyMasking(basicEvent);

      // Add to events array
      this.events.push(maskedEvent);

      // Add to batch for export
      this.batchEvents.push(maskedEvent);

      this.logger.debug("SessionReplayPlugin event added to arrays", {
        sessionId: this.sessionId,
        eventType: maskedEvent.type,
        totalEvents: this.events.length,
        batchEvents: this.batchEvents.length,
        batchSize: this.batchSize,
      });

      // Throttle events if configured
      if (this.config.throttleEvents && this.config.throttleDelay) {
        this.logger.debug("SessionReplayPlugin throttling event", {
          sessionId: this.sessionId,
          throttleDelay: this.config.throttleDelay,
          eventType: maskedEvent.type,
        });
        this.throttleEvent(maskedEvent);
      } else {
        this.processEventBatch();
      }

      this.state.lastEventTime = now;
      this.state.eventCount++;

      // Log every 100 events for monitoring
      if (this.state.eventCount % 100 === 0) {
        this.logger.info("SessionReplayPlugin event count milestone", {
          sessionId: this.sessionId,
          eventCount: this.state.eventCount,
          totalEvents: this.events.length,
          batchEvents: this.batchEvents.length,
          duration: now - this.state.startTime,
        });
      }
    } catch (error) {
      this.logger.error("SessionReplayPlugin failed to handle rrweb event", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventType: (event as Record<string, unknown>)?.type || "unknown",
        timestamp: new Date().toISOString(),
      });
    }
  }

  private throttleEvent(event: BasicEvent): void {
    this.logger.debug("SessionReplayPlugin throttling event", {
      sessionId: this.sessionId,
      eventType: event.type,
      throttleDelay: this.config.throttleDelay,
    });

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.logger.debug("SessionReplayPlugin cleared existing throttle timer", {
        sessionId: this.sessionId,
      });
    }

    this.lastThrottledEvent = event;

    this.throttleTimer = setTimeout(() => {
      this.logger.debug("SessionReplayPlugin throttle timer fired", {
        sessionId: this.sessionId,
        hasLastEvent: !!this.lastThrottledEvent,
      });
      if (this.lastThrottledEvent) {
        this.processEventBatch();
        this.lastThrottledEvent = null;
      }
    }, this.config.throttleDelay || 100);
  }

  private processEventBatch(): void {
    if (this.batchEvents.length === 0) {
      this.logger.debug("SessionReplayPlugin no events to process", {
        sessionId: this.sessionId,
      });
      return;
    }

    this.logger.debug("SessionReplayPlugin processing event batch", {
      sessionId: this.sessionId,
      batchSize: this.batchEvents.length,
      maxBatchSize: this.batchSize,
      hasTimer: !!this.batchTimer,
    });

    // Process batch if it's full or if we have a timer
    if (this.batchEvents.length >= this.batchSize) {
      this.logger.info(
        "SessionReplayPlugin batch full, exporting immediately",
        {
          sessionId: this.sessionId,
          batchSize: this.batchEvents.length,
          maxBatchSize: this.batchSize,
        }
      );
      this.exportEventBatch();
    } else if (!this.batchTimer) {
      // Set a timer to export remaining events after a delay
      this.logger.debug("SessionReplayPlugin setting batch timer", {
        sessionId: this.sessionId,
        batchSize: this.batchEvents.length,
        delay: 1000,
      });
      this.batchTimer = setTimeout(() => {
        this.logger.debug("SessionReplayPlugin batch timer fired", {
          sessionId: this.sessionId,
          batchSize: this.batchEvents.length,
        });
        this.exportEventBatch();
      }, 1000); // Export after 1 second if batch isn't full
    }
  }

  private exportEventBatch(): void {
    if (this.batchEvents.length === 0) {
      this.logger.debug("SessionReplayPlugin no events to export", {
        sessionId: this.sessionId,
      });
      return;
    }

    this.logger.info("SessionReplayPlugin exporting event batch", {
      sessionId: this.sessionId,
      batchSize: this.batchEvents.length,
      totalEvents: this.events.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Clear the batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
        this.logger.debug("SessionReplayPlugin cleared batch timer", {
          sessionId: this.sessionId,
        });
      }

      // Create batch event for export
      const batchEvent: SessionReplayEvent = {
        eventType: "session_replay",
        eventName: "session_replay",
        payload: {
          sessionId: this.sessionId,
          events: this.batchEvents.slice(),
          metadata: this.getMetadata(),
          config: this.config,
          rrweb_type: "events_batch" as const,
        },
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        ...(this.manager.getUserId() && {
          userId: this.manager.getUserId() ?? "",
        }),
      };

      this.logger.info("SessionReplayPlugin created batch event", {
        sessionId: this.sessionId,
        eventType: batchEvent.eventType,
        eventName: batchEvent.eventName,
        rrwebType: batchEvent.payload.rrweb_type,
        eventCount: batchEvent.payload.events.length,
        metadata: batchEvent.payload.metadata,
      });

      // Send to telemetry manager for export
      this.logger.info("SessionReplayPlugin about to call safeCapture", {
        sessionId: this.sessionId,
        eventType: batchEvent.eventType,
        eventName: batchEvent.eventName,
        hasSafeCapture: typeof this.safeCapture === "function",
        isEnabled: this.isEnabled,
        isInitialized: this.isInitialized,
        isDestroyed: this.isDestroyed,
        hasManager: !!this.manager,
      });

      this.safeCapture(batchEvent);

      this.logger.info("SessionReplayPlugin safeCapture call completed", {
        sessionId: this.sessionId,
        eventType: batchEvent.eventType,
        eventName: batchEvent.eventName,
      });

      this.logger.info(
        "SessionReplayPlugin batch event sent to telemetry manager",
        {
          sessionId: this.sessionId,
          eventCount: batchEvent.payload.events.length,
          timestamp: batchEvent.timestamp,
        }
      );

      // Clear the batch
      this.batchEvents = [];

      this.logger.debug("SessionReplayPlugin batch cleared", {
        sessionId: this.sessionId,
        remainingBatchEvents: this.batchEvents.length,
        totalEvents: this.events.length,
      });
    } catch (error) {
      this.logger.error("SessionReplayPlugin failed to export batch", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        batchSize: this.batchEvents.length,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private applyMasking(event: BasicEvent): BasicEvent {
    // Apply custom masking based on configuration
    if (this.config.maskTextInputs || this.config.maskAllInputs) {
      this.logger.debug("SessionReplayPlugin applying masking", {
        sessionId: this.sessionId,
        eventType: event.type,
        maskTextInputs: this.config.maskTextInputs,
        maskAllInputs: this.config.maskAllInputs,
      });
      // This is a simplified masking - in production you'd want more sophisticated masking
      // that preserves the structure while hiding sensitive content
      return this.maskSensitiveData(event);
    }

    return event;
  }

  private maskSensitiveData(event: BasicEvent): BasicEvent {
    this.logger.debug("SessionReplayPlugin masking sensitive data", {
      sessionId: this.sessionId,
      eventType: event.type,
      hasMaskTextSelector: !!this.config.maskTextSelector,
      hasMaskInputSelector: !!this.config.maskInputSelector,
    });

    // Deep clone the event to avoid mutating the original
    const maskedEvent = JSON.parse(JSON.stringify(event)) as BasicEvent;

    // Apply masking based on selectors
    if (this.config.maskTextSelector || this.config.maskInputSelector) {
      // This would require more sophisticated DOM traversal
      // For now, we'll just return the event as-is
      // In a full implementation, you'd traverse the DOM and mask sensitive elements
      this.logger.debug(
        "SessionReplayPlugin masking selectors configured but not implemented",
        {
          sessionId: this.sessionId,
          maskTextSelector: this.config.maskTextSelector,
          maskInputSelector: this.config.maskInputSelector,
        }
      );
    }

    return maskedEvent;
  }

  private getMetadata(): SessionReplayMetadata {
    const currentTime = Date.now();
    const duration = this.state.isRecording
      ? undefined
      : currentTime - this.state.startTime;
    const endTime = this.state.isRecording ? undefined : currentTime;

    return {
      startTime: this.state.startTime,
      ...(endTime !== undefined && { endTime }),
      ...(duration !== undefined && { duration }),
      eventCount: this.state.eventCount,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent:
        typeof window !== "undefined" && typeof window.navigator !== "undefined"
          ? window.navigator.userAgent
          : "",
      viewport: {
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      },
      devicePixelRatio:
        typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
  }

  private sendSessionStartEvent(): void {
    this.logger.info("SessionReplayPlugin sending session start event", {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });

    const sessionStartEvent: SessionReplayEvent = {
      eventType: "session_replay",
      eventName: "session_replay",
      payload: {
        sessionId: this.sessionId,
        events: [],
        metadata: this.getMetadata(),
        config: this.config,
        rrweb_type: "session_start" as const,
      },
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...(this.manager.getUserId() && {
        userId: this.manager.getUserId() ?? "",
      }),
    };

    this.logger.info("SessionReplayPlugin created session start event", {
      sessionId: this.sessionId,
      eventType: sessionStartEvent.eventType,
      eventName: sessionStartEvent.eventName,
      rrwebType: sessionStartEvent.payload.rrweb_type,
      metadata: sessionStartEvent.payload.metadata,
    });

    this.safeCapture(sessionStartEvent);

    this.logger.info("SessionReplayPlugin session start event sent", {
      sessionId: this.sessionId,
      timestamp: sessionStartEvent.timestamp,
    });
  }

  private sendSessionEndEvent(): void {
    this.logger.info("SessionReplayPlugin sending session end event", {
      sessionId: this.sessionId,
      totalEvents: this.events.length,
      timestamp: new Date().toISOString(),
    });

    // Export any remaining batched events
    this.exportEventBatch();

    const sessionEndEvent: SessionReplayEvent = {
      eventType: "session_replay",
      eventName: "session_replay",
      payload: {
        sessionId: this.sessionId,
        events: this.events.slice(),
        metadata: this.getMetadata(),
        config: this.config,
        rrweb_type: "session_end" as const,
      },
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.manager.getUserId() || "",
    };

    this.logger.info("SessionReplayPlugin created session end event", {
      sessionId: this.sessionId,
      eventType: sessionEndEvent.eventType,
      eventName: sessionEndEvent.eventName,
      rrwebType: sessionEndEvent.payload.rrweb_type,
      eventCount: sessionEndEvent.payload.events.length,
      metadata: sessionEndEvent.payload.metadata,
    });

    this.safeCapture(sessionEndEvent);

    this.logger.info("SessionReplayPlugin session end event sent", {
      sessionId: this.sessionId,
      eventCount: sessionEndEvent.payload.events.length,
      timestamp: sessionEndEvent.timestamp,
    });
  }

  public stopRecording(): void {
    this.logger.info("SessionReplayPlugin stopRecording called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      totalEvents: this.events.length,
      timestamp: new Date().toISOString(),
    });

    if (!this.state.isRecording) {
      this.logger.warn("SessionReplayPlugin not recording, skipping stop", {
        sessionId: this.sessionId,
      });
      return;
    }

    try {
      this.state.isRecording = false;

      this.logger.info("SessionReplayPlugin stopped recording state", {
        sessionId: this.sessionId,
        totalEvents: this.events.length,
        duration: Date.now() - this.state.startTime,
      });

      // Stop rrweb recording
      if (this.stopFn) {
        this.stopFn();
        this.stopFn = null;
        this.logger.info("SessionReplayPlugin stopped rrweb recording", {
          sessionId: this.sessionId,
        });
      }

      // Clear timers
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
        this.logger.debug("SessionReplayPlugin cleared throttle timer", {
          sessionId: this.sessionId,
        });
      }

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
        this.logger.debug("SessionReplayPlugin cleared batch timer", {
          sessionId: this.sessionId,
        });
      }

      // Process any remaining throttled event
      if (this.lastThrottledEvent) {
        this.batchEvents.push(this.lastThrottledEvent);
        this.lastThrottledEvent = null;
        this.logger.debug(
          "SessionReplayPlugin processed remaining throttled event",
          {
            sessionId: this.sessionId,
          }
        );
      }

      // Send session end event
      this.sendSessionEndEvent();

      this.logger.info("SessionReplayPlugin recording stopped successfully", {
        sessionId: this.sessionId,
        eventCount: this.events.length,
        duration: Date.now() - this.state.startTime,
        finalState: this.state,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("SessionReplayPlugin failed to stop recording", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public pauseRecording(): void {
    this.logger.info("SessionReplayPlugin pauseRecording called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      isPaused: this.state.isPaused,
    });

    if (!this.state.isRecording) {
      this.logger.warn("SessionReplayPlugin not recording, cannot pause", {
        sessionId: this.sessionId,
      });
      return;
    }

    this.state.isPaused = true;
    this.logger.info("SessionReplayPlugin recording paused", {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      timestamp: new Date().toISOString(),
    });
  }

  public resumeRecording(): void {
    this.logger.info("SessionReplayPlugin resumeRecording called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      isPaused: this.state.isPaused,
    });

    if (!this.state.isRecording || !this.state.isPaused) {
      this.logger.warn(
        "SessionReplayPlugin cannot resume - not recording or not paused",
        {
          sessionId: this.sessionId,
          isRecording: this.state.isRecording,
          isPaused: this.state.isPaused,
        }
      );
      return;
    }

    this.state.isPaused = false;
    this.logger.info("SessionReplayPlugin recording resumed", {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      timestamp: new Date().toISOString(),
    });
  }

  public getSessionData(): SessionReplayPayload | null {
    this.logger.debug("SessionReplayPlugin getSessionData called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      eventCount: this.events.length,
    });

    if (!this.state.isRecording && this.events.length === 0) {
      this.logger.debug("SessionReplayPlugin no session data available", {
        sessionId: this.sessionId,
      });
      return null;
    }

    const sessionData = {
      sessionId: this.sessionId,
      events: this.events.slice(),
      metadata: this.getMetadata(),
      config: this.config,
      rrweb_type: "session_end" as const,
    };

    this.logger.debug("SessionReplayPlugin returning session data", {
      sessionId: this.sessionId,
      eventCount: sessionData.events.length,
      metadata: sessionData.metadata,
    });

    return sessionData;
  }

  public getState(): SessionReplayState {
    this.logger.debug("SessionReplayPlugin getState called", {
      sessionId: this.sessionId,
      state: this.state,
    });

    return { ...this.state };
  }

  teardown(): void {
    this.logger.info("SessionReplayPlugin teardown called", {
      sessionId: this.sessionId,
      isRecording: this.state.isRecording,
      eventCount: this.events.length,
      timestamp: new Date().toISOString(),
    });

    this.stopRecording();

    this.logger.info("SessionReplayPlugin teardown completed", {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}
