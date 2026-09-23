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
    if (responseId && this.ignored.has(responseId)) return null;
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
    const clean = text.trim();
    // Reject unsupported scripts and tiny VAD noise before it can enter the UI or a tool.
    if (/[^\p{Script=Cyrillic}\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}]/u.test(clean) ||
        (clean.match(/[\p{Script=Cyrillic}\p{Script=Latin}\p{Number}]/gu)?.length ?? 0) < 3) return false;
    this.transcript = clean;
    return Boolean(this.transcript);
  }
  peek() { return this.transcript; }
  take() { const text = this.transcript; this.transcript = ""; this.active = false; return text; }
  clear() { this.transcript = ""; this.active = false; this.inputItemId = undefined; }
}

// One result can trigger one follow-up, with an absolute cap per user turn.
export class AutomaticResponseGate {
  private handled = new Set<string>();
  private responses = 0;
  resetTurn() { this.responses = 0; }
  claim(callId: string): boolean {
    if (!callId || this.handled.has(callId)) return false;
    this.handled.add(callId);
    return true;
  }
  followUp(): boolean {
    if (this.responses >= 2) return false;
    this.responses++;
    return true;
  }
}

export function mentionedSupplier(text: string): "IEK" | "SE" | undefined {
  if (/\biek\b|иэк/i.test(text)) return "IEK";
  if (/\bse\b|сэ/i.test(text)) return "SE";
  return undefined;
}
