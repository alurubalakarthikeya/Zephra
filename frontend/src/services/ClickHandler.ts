// Secret Click Detector - Detects 5 clicks within 2 seconds
export interface ClickEvent {
  timestamp: number;
  count: number;
}

class ClickHandler {
  private clicks: ClickEvent[] = [];
  private readonly REQUIRED_CLICKS = 5;
  private readonly TIME_WINDOW = 2000; // 2 seconds
  private timeoutId: number | null = null;
  private onSuccess: () => void;
  private onProgress: (count: number) => void;

  constructor(onSuccess: () => void, onProgress: (count: number) => void) {
    this.onSuccess = onSuccess;
    this.onProgress = onProgress;
  }

  public registerClick(): void {
    const now = Date.now();
    
    // Remove old clicks outside time window
    this.clicks = this.clicks.filter(click => now - click.timestamp <= this.TIME_WINDOW);
    
    // Add new click
    this.clicks.push({ timestamp: now, count: this.clicks.length + 1 });
    
    // Notify progress (for visual counter)
    this.onProgress(this.clicks.length);
    
    // Check if we reached the target
    if (this.clicks.length >= this.REQUIRED_CLICKS) {
      this.triggerSuccess();
      return;
    }
    
    // Set auto-reset timer
    this.resetTimeout();
  }

  private resetTimeout(): void {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = window.setTimeout(() => {
      if (this.clicks.length > 0 && this.clicks.length < this.REQUIRED_CLICKS) {
        this.reset();
      }
    }, this.TIME_WINDOW);
  }

  private triggerSuccess(): void {
    this.clearTimeout();
    this.onSuccess();
    this.reset();
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public reset(): void {
    this.clicks = [];
    this.clearTimeout();
    this.onProgress(0);
  }

  public getCurrentCount(): number {
    // Clean up old clicks first
    const now = Date.now();
    this.clicks = this.clicks.filter(click => now - click.timestamp <= this.TIME_WINDOW);
    return this.clicks.length;
  }
}

export default ClickHandler;