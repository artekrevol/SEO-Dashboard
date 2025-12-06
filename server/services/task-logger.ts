import { storage } from "../storage";
import type { InsertTaskExecutionLog, TaskExecutionLog, TaskLogLevel, TaskLogCategory } from "@shared/schema";

interface TaskContext {
  taskId: string;
  taskType: string;
  category: TaskLogCategory;
  projectId?: string;
  crawlResultId?: number;
  startTime: number;
}

class TaskLogger {
  private static generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static createContext(
    taskType: string,
    category: TaskLogCategory,
    options?: { projectId?: string; crawlResultId?: number; taskId?: string }
  ): TaskContext {
    return {
      taskId: options?.taskId || this.generateTaskId(),
      taskType,
      category,
      projectId: options?.projectId,
      crawlResultId: options?.crawlResultId,
      startTime: Date.now(),
    };
  }

  static async log(
    context: TaskContext,
    level: TaskLogLevel,
    message: string,
    details?: Record<string, unknown>,
    errorStack?: string
  ): Promise<TaskExecutionLog | null> {
    try {
      const logEntry: InsertTaskExecutionLog = {
        taskId: context.taskId,
        taskType: context.taskType,
        category: context.category,
        level,
        message,
        projectId: context.projectId || null,
        crawlResultId: context.crawlResultId || null,
        details: details || null,
        errorStack: errorStack || null,
        duration: Date.now() - context.startTime,
      };

      return await storage.createTaskLog(logEntry);
    } catch (error) {
      console.error("[TaskLogger] Failed to write log:", error);
      return null;
    }
  }

  static async debug(context: TaskContext, message: string, details?: Record<string, unknown>): Promise<TaskExecutionLog | null> {
    console.log(`[${context.taskType}] ${message}`, details || "");
    return this.log(context, "debug", message, details);
  }

  static async info(context: TaskContext, message: string, details?: Record<string, unknown>): Promise<TaskExecutionLog | null> {
    console.log(`[${context.taskType}] ${message}`, details || "");
    return this.log(context, "info", message, details);
  }

  static async warn(context: TaskContext, message: string, details?: Record<string, unknown>): Promise<TaskExecutionLog | null> {
    console.warn(`[${context.taskType}] ${message}`, details || "");
    return this.log(context, "warn", message, details);
  }

  static async error(
    context: TaskContext,
    message: string,
    error?: Error | unknown,
    details?: Record<string, unknown>
  ): Promise<TaskExecutionLog | null> {
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[${context.taskType}] ${message}`, errorMessage, details || "");
    
    return this.log(
      context,
      "error",
      message,
      { ...details, errorMessage },
      errorStack
    );
  }

  static async complete(
    context: TaskContext,
    success: boolean,
    summary?: Record<string, unknown>
  ): Promise<TaskExecutionLog | null> {
    const duration = Date.now() - context.startTime;
    const level = success ? "info" : "error";
    const message = success 
      ? `Task completed successfully in ${duration}ms` 
      : `Task failed after ${duration}ms`;
    
    return this.log(context, level, message, { ...summary, duration, success });
  }
}

export { TaskLogger, TaskContext };
