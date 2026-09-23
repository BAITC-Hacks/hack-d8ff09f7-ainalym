# L4c integration notes

- L4b/L4a: import `AssistantPanel` from `@/components/assistant`; props `scope?: {org_id, supplier_id?, code_1c?}`, `onClose?`, `variant?: "panel" | "page"`. `/assistant` is a two-line page entry for L4a's existing navigation.
- L5: current public hook exposes captions only. Please expose successful tool responses as additive `results` (request id, tool, response), or dispatch `ainalym:voice-tool-result` with `{request_id, tool, result}` after confirmed HTTP success. L4c can then render the identical `ResultCard`; no voice implementation is edited here. Spoken-result gate remains externally-unverified until integrated and root microphone run.
- L1: Связи requires `/api/modes` labels and data-source metadata (source file names, source dates/as-of, anonymised status); missing metadata renders unavailable, never invented dates. Health supplies provider name only. Ensure `axes.ai` normalises provider names (`jev`, `openai`, `offline`) into §5 values.
- L4a: world console will reuse `WorldFeed` after it lands. Full feed currently returns `{rows}` (L6), not `{events}`.
- Reframe takes precedence: four replenishment tools; 1С row `Экспорт для 1С (файл)`; no historical simulator-integration meta claim unless served by the current API.
