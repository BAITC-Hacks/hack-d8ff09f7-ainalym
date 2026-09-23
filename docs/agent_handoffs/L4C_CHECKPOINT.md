# L4c checkpoint 5 — tier-2 notifications
done: read-only /api/notifications over L1 repositories; bell on /sales and /documents; native dialog, focus return, confirmed attention count.
checks: UI suite and build/type check passed after latest main merge; API test proves reads preserve proposal state and state_version.
deps: none.
undone: search checkpoint; landing last; global bell mount belongs to L4a (exported NotificationsBell seam).
resumable: notifications report unresolved work, never claim a read/unread write; see L4C_INTEGRATION_NOTES.md.
Gate: RED — integrated modes/source metadata and actual spoken-result gate remain incomplete.
sha: this checkpoint commit (git log -1 --format=%H -- docs/agent_handoffs/L4C_CHECKPOINT.md).
