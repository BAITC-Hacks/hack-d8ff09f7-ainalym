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
