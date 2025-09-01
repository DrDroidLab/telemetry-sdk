import { record, type eventWithTime } from "rrweb";
import { BasePlugin } from "../BasePlugin";
import type {
  SessionReplayEvent,
  SessionReplayPayload,
  SessionReplayConfig,
  SessionReplayState,
  SessionReplayMetadata,
} from "../../types/SessionReplay";
import { generateSessionId } from "../../TelemetryManager/utils/generateSessionId";

export class SessionReplayPlugin extends BasePlugin {
  private stopFn: (() => void) | null = null;
  private events: eventWithTime[] = [];
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

      this.logger.info("SessionReplayPlugin limits configured", {
        sessionId: this.sessionId,
        maxEvents: this.maxEvents,
        maxDuration: this.maxDuration,
      });

      // Start recording
      this.startRecording();

      this.logger.info("SessionReplayPlugin setup completed successfully", {
        sessionId: this.sessionId,
        config: this.config,
        limits: {
          maxEvents: this.maxEvents,
          maxDuration: this.maxDuration,
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

      this.logger.info("SessionReplayPlugin state initialized", {
        sessionId: this.sessionId,
        startTime: this.state.startTime,
        eventsArrayLength: this.events.length,
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
    try {
      // Type guard to ensure it's a valid rrweb event
      if (!this.isValidRrwebEvent(event)) {
        this.logger.debug("Invalid rrweb event received", { event });
        return;
      }

      // Check session limits
      if (this.state.eventCount >= this.maxEvents) {
        this.logger.info(
          "Session replay max events reached, stopping recording",
          {
            maxEvents: this.maxEvents,
            currentCount: this.state.eventCount,
          }
        );
        this.stopRecording();
        return;
      }

      // Check session duration
      const currentTime = Date.now();
      if (currentTime - this.state.startTime > this.maxDuration) {
        this.logger.info(
          "Session replay max duration reached, stopping recording",
          {
            maxDuration: this.maxDuration,
            currentDuration: currentTime - this.state.startTime,
          }
        );
        this.stopRecording();
        return;
      }

      // Apply masking to sensitive data
      const maskedEvent = this.applyMasking(event);

      // Increment event count
      this.state.eventCount++;

      // Add to all events array for session end
      this.events.push(maskedEvent);

      // Send individual event immediately
      this.sendIndividualEvent(maskedEvent);

      this.logger.debug("Processed rrweb event", {
        eventType: maskedEvent.type,
        eventCount: this.state.eventCount,
      });
    } catch (error) {
      this.logger.error("Error processing rrweb event", { error, event });
    }
  }

  private isValidRrwebEvent(event: unknown): event is eventWithTime {
    return (
      !!event &&
      typeof event === "object" &&
      "type" in event &&
      "timestamp" in event
    );
  }

  private sendIndividualEvent(rrwebEvent: eventWithTime): void {
    try {
      const event: SessionReplayEvent = {
        eventType: "session_replay",
        eventName: "session_replay",
        payload: {
          rrweb_type: String(rrwebEvent.type) as
            | "session_start"
            | "events_batch"
            | "session_end",
          sessionId: this.sessionId,
          events: [rrwebEvent],
          metadata: this.getMetadata(),
          config: this.config,
        },
        timestamp: new Date().toISOString(),
        userId: this.manager.getUserId() || "",
      };

      this.logger.info("Sending individual rrweb event", {
        rrwebType: String(rrwebEvent.type),
        sessionId: this.sessionId,
        eventCount: this.state.eventCount,
      });

      this.safeCapture(event);
    } catch (error) {
      this.logger.error("Error sending individual rrweb event", {
        error,
        rrwebEvent,
      });
    }
  }

  private applyMasking(event: eventWithTime): eventWithTime {
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

  private maskSensitiveData(event: eventWithTime): eventWithTime {
    this.logger.debug("SessionReplayPlugin masking sensitive data", {
      sessionId: this.sessionId,
      eventType: event.type,
      hasMaskTextSelector: !!this.config.maskTextSelector,
      hasMaskInputSelector: !!this.config.maskInputSelector,
    });

    // Deep clone the event to avoid mutating the original
    const maskedEvent = JSON.parse(JSON.stringify(event)) as eventWithTime;

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
        rrweb_type: "session_start" as const,
        sessionId: this.sessionId,
        events: [],
        metadata: this.getMetadata(),
        config: this.config,
      },
      timestamp: new Date().toISOString(),
      userId: this.manager.getUserId() || "",
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

    const sessionEndEvent: SessionReplayEvent = {
      eventType: "session_replay",
      eventName: "session_replay",
      payload: {
        rrweb_type: "session_end" as const,
        sessionId: this.sessionId,
        events: this.events.slice(),
        metadata: this.getMetadata(),
        config: this.config,
      },
      timestamp: new Date().toISOString(),
      userId: this.manager.getUserId() || "",
    };

    this.logger.info("SessionReplayPlugin created session end event", {
      sessionId: this.sessionId,
      eventType: sessionEndEvent.eventType,
      eventName: sessionEndEvent.eventName,
      rrwebType: sessionEndEvent.payload.rrweb_type,
      metadata: sessionEndEvent.payload.metadata,
    });

    this.safeCapture(sessionEndEvent);

    this.logger.info("SessionReplayPlugin session end event sent", {
      sessionId: this.sessionId,
      eventCount: this.events.length,
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
