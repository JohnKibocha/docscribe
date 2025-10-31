/**
 * @fileoverview Comprehensive logging system for DocScribe development and debugging.
 * 
 * This module provides detailed logging capabilities specifically designed for tracking
 * the medical transcription pipeline. It logs full inputs/outputs, performance metrics,
 * errors, and debugging information in development mode.
 * 
 * Key Features:
 * - Full input/output capture for AI interactions
 * - Performance timing for each pipeline stage
 * - Error tracking with stack traces
 * - Audio blob metadata logging
 * - Development-only operation with production safety
 * 
 * @module utils/logger
 */

/**
 * Log level constants for categorizing log messages.
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO', 
  WARN: 'WARN',
  ERROR: 'ERROR',
  PERFORMANCE: 'PERFORMANCE'
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 * Interface for structured log entries.
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  duration?: number;
  error?: Error;
}

/**
 * Interface for performance timing entries.
 */
interface PerformanceEntry {
  stage: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Main logger class with comprehensive medical transcription pipeline logging.
 */
class DocScribeLogger {
  private logs: LogEntry[] = [];
  private performanceStack: PerformanceEntry[] = [];
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    if (this.isDevelopment) {
      console.log('[INFO] DocScribe Logger initialized in development mode');
    }
  }

  /**
   * Creates a formatted log entry with timestamp and structured data.
   * 
   * @param level - The log level
   * @param component - The component/module name
   * @param message - The log message
   * @param data - Additional data to log
   * @param error - Error object if applicable
   * @param duration - Duration in milliseconds if applicable
   */
  private createLogEntry(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error,
      duration
    };
  }

  /**
   * Logs a message with data to console and internal storage.
   * 
   * @param level - The log level
   * @param component - The component/module name
   * @param message - The log message
   * @param data - Additional data to log
   * @param error - Error object if applicable
   * @param duration - Duration in milliseconds if applicable
   */
  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error,
    duration?: number
  ): void {
    if (!this.isDevelopment) return;

    const entry = this.createLogEntry(level, component, message, data, error, duration);
    this.logs.push(entry);

    // Format console output with emoji and colors
    const emoji = this.getEmojiForLevel(level);
    const timestamp = new Date().toLocaleTimeString();
    
    const logMessage = `${emoji} [${timestamp}] ${component}: ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data);
        break;
      case LogLevel.INFO:
        console.info(logMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, data, error);
        break;
      case LogLevel.PERFORMANCE:
        console.log(`[INFO] [${timestamp}] ${component}: ${message} (${duration}ms)`, data);
        break;
    }
  }

  /**
   * Gets emoji for log level.
   */
  private getEmojiForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '[DEBUG]';
      case LogLevel.INFO: return '[INFO]';
      case LogLevel.WARN: return '[WARN]';
      case LogLevel.ERROR: return '[ERROR]';
      case LogLevel.PERFORMANCE: return '[PERFORMANCE]';
      default: return '[LOG]';
    }
  }

  /**
   * Logs debug information.
   */
  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  /**
   * Logs general information.
   */
  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  /**
   * Logs warning messages.
   */
  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  /**
   * Logs error messages with stack traces.
   */
  error(component: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, component, message, data, error);
  }

  /**
   * Starts a performance timer for a specific stage.
   */
  startPerformanceTimer(stage: string): void {
    if (!this.isDevelopment) return;

    const entry: PerformanceEntry = {
      stage,
      startTime: performance.now()
    };
    
    this.performanceStack.push(entry);
    this.debug('Performance', `Started timing: ${stage}`);
  }

  /**
   * Ends a performance timer and logs the duration.
   */
  endPerformanceTimer(stage: string, data?: any): number {
    if (!this.isDevelopment) return 0;

    const entryIndex = this.performanceStack.findIndex(entry => 
      entry.stage === stage && !entry.endTime
    );
    
    if (entryIndex === -1) {
      this.warn('Performance', `No active timer found for stage: ${stage}`);
      return 0;
    }

    const entry = this.performanceStack[entryIndex];
    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    this.log(LogLevel.PERFORMANCE, 'Performance', `Completed: ${stage}`, data, undefined, entry.duration);
    
    return entry.duration;
  }

  /**
   * Logs audio blob metadata for debugging.
   */
  logAudioBlob(component: string, blob: Blob, stage: string): void {
    const metadata = {
      size: blob.size,
      type: blob.type,
      sizeKB: Math.round(blob.size / 1024),
      sizeMB: Math.round(blob.size / 1024 / 1024 * 100) / 100,
      stage
    };
    
    this.info(component, `Audio blob ${stage}`, metadata);
  }

  /**
   * Logs AI interaction with full input/output capture.
   */
  logAIInteraction(
    component: string,
    stage: string,
    input: any,
    output: any,
    duration: number,
    model?: string
  ): void {
    const interaction = {
      stage,
      model: model || 'Gemini Nano',
      inputSize: typeof input === 'string' ? input.length : JSON.stringify(input).length,
      outputSize: typeof output === 'string' ? output.length : JSON.stringify(output).length,
      duration,
      input: this.truncateForLog(input),
      output: this.truncateForLog(output),
      fullInput: input,  // Full data for debugging
      fullOutput: output  // Full data for debugging
    };
    
    this.log(LogLevel.PERFORMANCE, component, `AI interaction: ${stage}`, interaction, undefined, duration);
  }

  /**
   * Logs pipeline stage completion with input/output data.
   */
  logPipelineStage(
    stage: string,
    input: any,
    output: any,
    duration: number,
    metadata?: any
  ): void {
    const stageData = {
      stage,
      inputType: typeof input,
      outputType: typeof output,
      inputSize: typeof input === 'string' ? input.length : 
                 input instanceof Blob ? input.size : 
                 JSON.stringify(input).length,
      outputSize: typeof output === 'string' ? output.length : 
                  JSON.stringify(output).length,
      duration,
      metadata,
      input: this.truncateForLog(input),
      output: this.truncateForLog(output)
    };
    
    this.log(LogLevel.PERFORMANCE, 'Pipeline', `Stage completed: ${stage}`, stageData, undefined, duration);
  }

  /**
   * Truncates large data for console logging while preserving full data.
   */
  private truncateForLog(data: any, maxLength: number = 500): any {
    if (typeof data === 'string') {
      return data.length > maxLength ? 
        data.substring(0, maxLength) + '... [TRUNCATED]' : 
        data;
    }
    
    if (data instanceof Blob) {
      return `[Blob: ${data.size} bytes, ${data.type}]`;
    }
    
    const str = JSON.stringify(data);
    return str.length > maxLength ? 
      str.substring(0, maxLength) + '... [TRUNCATED]' : 
      data;
  }

  /**
   * Logs error with full context and stack trace.
   */
  logError(
    component: string,
    operation: string,
    error: Error,
    context?: any
  ): void {
    const errorData = {
      operation,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    this.error(component, `Error in ${operation}`, error, errorData);
  }

  /**
   * Exports all logs for debugging or support.
   */
  exportLogs(): string {
    if (!this.isDevelopment) return '';
    
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      logCount: this.logs.length,
      logs: this.logs,
      performanceTimers: this.performanceStack
    }, null, 2);
  }

  /**
   * Clears all stored logs.
   */
  clearLogs(): void {
    this.logs = [];
    this.performanceStack = [];
    this.info('Logger', 'Logs cleared');
  }

  /**
   * Gets summary of recent activity for debugging.
   */
  getRecentActivity(minutes: number = 5): LogEntry[] {
    if (!this.isDevelopment) return [];
    
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter(log => new Date(log.timestamp) > cutoff);
  }

  /**
   * Gets performance summary for all stages.
   */
  getPerformanceSummary(): any {
    if (!this.isDevelopment) return {};
    
    const completed = this.performanceStack.filter(entry => entry.duration);
    const byStage = completed.reduce((acc, entry) => {
      if (!acc[entry.stage]) {
        acc[entry.stage] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      acc[entry.stage].count++;
      acc[entry.stage].totalDuration += entry.duration!;
      acc[entry.stage].avgDuration = acc[entry.stage].totalDuration / acc[entry.stage].count;
      return acc;
    }, {} as any);
    
    return byStage;
  }
}

// Create singleton instance
export const logger = new DocScribeLogger();

// Convenience functions for common logging patterns
export const logAudioProcessing = (stage: string, blob: Blob) => {
  logger.logAudioBlob('AudioProcessing', blob, stage);
};

export const logAICall = (
  stage: string,
  input: any,
  output: any,
  duration: number,
  model?: string
) => {
  logger.logAIInteraction('ChromeAI', stage, input, output, duration, model);
};

export const logPipelineStep = (
  stage: string,
  input: any,
  output: any,
  duration: number,
  metadata?: any
) => {
  logger.logPipelineStage(stage, input, output, duration, metadata);
};

export const logError = (component: string, operation: string, error: Error, context?: any) => {
  logger.logError(component, operation, error, context);
};

// Export timer functions
export const startTimer = (stage: string) => logger.startPerformanceTimer(stage);
export const endTimer = (stage: string, data?: any) => logger.endPerformanceTimer(stage, data);

// Development helper functions
export const exportLogs = () => logger.exportLogs();
export const clearLogs = () => logger.clearLogs();
export const getPerformanceSummary = () => logger.getPerformanceSummary();

/**
 * Global error handler for unhandled errors in development.
 */
if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    logger.error('Global', 'Unhandled error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Global', 'Unhandled promise rejection', event.reason);
  });
}