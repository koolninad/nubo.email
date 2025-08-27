export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry = () => {},
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      const retryDelay = Math.min(
        delay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );
      
      onRetry(error, attempt);
      
      await sleep(retryDelay);
    }
  }
  
  throw lastError;
}

/**
 * Default retry condition - retry on network errors and specific status codes
 */
function defaultShouldRetry(error: any): boolean {
  // Retry on network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ENOTFOUND') {
    return true;
  }
  
  // Retry on RetryableError
  if (error instanceof RetryableError) {
    return error.retryable;
  }
  
  // Retry on specific HTTP status codes
  if (error.response) {
    const status = error.response.status;
    return status === 429 || // Too Many Requests
           status === 502 || // Bad Gateway
           status === 503 || // Service Unavailable
           status === 504;   // Gateway Timeout
  }
  
  // Don't retry on other errors
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      
      // Auto-reset after timeout
      setTimeout(() => {
        this.state = 'HALF_OPEN';
      }, this.resetTimeout);
    }
  }
  
  private reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Rate limiter for controlling request frequency
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  
  constructor(
    private readonly maxRequests: number = 10,
    private readonly interval: number = 1000 // 1 second
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    const batch = this.queue.splice(0, this.maxRequests);
    
    await Promise.all(batch.map(fn => fn()));
    
    setTimeout(() => {
      this.processQueue();
    }, this.interval);
  }
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Batch processor for handling multiple operations efficiently
 */
export class BatchProcessor<T, R> {
  private batch: Array<{ item: T; resolve: (value: R) => void; reject: (error: any) => void }> = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly processor: (items: T[]) => Promise<R[]>,
    private readonly batchSize: number = 10,
    private readonly batchDelay: number = 100
  ) {}
  
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push({ item, resolve, reject });
      
      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }
  
  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.batch.length === 0) return;
    
    const currentBatch = this.batch.splice(0, this.batchSize);
    const items = currentBatch.map(b => b.item);
    
    try {
      const results = await this.processor(items);
      
      currentBatch.forEach((b, i) => {
        b.resolve(results[i]);
      });
    } catch (error) {
      currentBatch.forEach(b => {
        b.reject(error);
      });
    }
    
    // Process remaining items
    if (this.batch.length > 0) {
      this.flush();
    }
  }
}