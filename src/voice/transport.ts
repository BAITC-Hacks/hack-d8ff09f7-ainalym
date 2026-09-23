// Keeps an interrupted response from dispatching a late tool call or speaking from it.
export class VoiceTurnGate {
  private epoch = 0;
  private activeResponse?: string;
  private ignored = new Set<string>();
  private pending = new Set<AbortController>();

  created(responseId: string) { this.activeResponse = responseId; }
  cancel() {
    this.epoch++;
    if (this.activeResponse) this.ignored.add(this.activeResponse);
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
  }
  accept(responseId?: string): number | null {
    if (responseId && this.ignored.delete(responseId)) return null;
    return this.epoch;
  }
  isCurrent(epoch: number) { return epoch === this.epoch; }
  track(controller: AbortController) { this.pending.add(controller); }
  done(controller: AbortController) { this.pending.delete(controller); }
}

export class TranscriptGate {
  private inputItemId?: string;
  private transcript = "";
  private active = false;
  started(itemId?: string) { this.inputItemId = itemId; this.transcript = ""; this.active = true; }
  completed(itemId: string | undefined, text: string): boolean {
    if (!this.active) return false;
    if (this.inputItemId && itemId !== this.inputItemId) return false;
    this.transcript = text.trim();
    return Boolean(this.transcript);
  }
  peek() { return this.transcript; }
  take() { const text = this.transcript; this.transcript = ""; this.active = false; return text; }
  clear() { this.transcript = ""; this.active = false; this.inputItemId = undefined; }
}
