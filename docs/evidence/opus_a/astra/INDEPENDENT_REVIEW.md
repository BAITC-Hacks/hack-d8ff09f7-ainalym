# Independent Opus A gate review

Current gate: **YELLOW** after the final copy recheck below. The initial gate was RED: a visible quantity-edit flow could not complete, and a Today metric labeled proposals as orders ready for approval.

Scope: `localhost:3111/opus_a/today`, `/opus_a/replenishment`, and `/opus_a/skus/130200122_`; shared UI under `src/components/opus_a` and `src/styles/opus_a`. Baseline reference supplied: `da810b1`. This was a dry run; no source, API mutation, database, or environment write was made.

## Findings

1. **High — quantity editing is advertised but unavailable.** From `/opus_a/skus/130200122_`, select the prominent **Изменить количество** button. The recommendation scrolls into view, then reports **Изменение количества пока недоступно / Сервис корректировки недоступен. Количество не изменено**. The same result occurs at `/opus_a/replenishment?code=130200122_` after selecting **Изменить количество** in the expanded row. The current `OPTIONS` capability check routes 404/501 to this terminal state at `src/components/opus_a/AdjustForm.tsx:26-28`; the entry points remain visible at `SkuCard.tsx:40` and `Replenishment.tsx:48`. The purchasing manager cannot complete the stated quantity-check-and-adjust task. Expose the action only when the capability exists, or provide a real editable route. Keep the unavailable explanation in context when the backend cannot save.

2. **Medium — proposal money is labeled as orders ready for approval.** On Today, the **Заказы к утверждению** metric shows **67 763 248 ₸** while the queue item is still a proposal. Opening **Решить…** for SE shows **Подготовить заказ** and explains that this action creates a draft, after which the order can be approved. No prepared-orders section was visible before this step. `src/components/opus_a/Today.tsx:164` sums proposal `money_at_stake`; `Today.tsx:100-103` names the actual stage. Label that metric as proposals awaiting review/preparation, and reserve approval language for the created order stage. The Today header **Проверить заказы** at `Today.tsx:151` leads to recommendations, so its label should name that destination accurately.

## Checks and limits

- Rendered all three routes at **1440×900** and **390×844**. After data loaded, document width equaled viewport width on each; no page-level horizontal overflow. The phone replenishment table converted to labeled cards, and its row detail expanded without overflow.
- Observed Today queue and SE confirmation: 294 positions, 67,753 units, cost known for 262 of 294; the confirmation moves focus to **Подготовить заказ**. No approval or reject POST was sent.
- Observed SKU `130200122_` recommendation: 440 units with 295.9 forecast, 110.8 safety, −144 on hand, 120 in transit, and pack multiple 20. The displayed need of 430.6 rounds to 440; no quantity mismatch was found in this inspected item.
- Global search for `130200122_` returned the matching SKU; Enter navigated to its detail with `from=/opus_a/today`. Replenishment's `?code=130200122_` filtered to and expanded the matching row.
- Did not verify save success, approval/rejection, order export, or persistence because those are mutations or follow-on flows blocked by the dry-run scope. Did not force error/offline states or inspect `/review/*` task pages, which lie outside the three-screen scope. API totals for all 1,259 recommendations and all source documents were not independently reconciled.

Files changed: this report only.

## Recheck after builder changes

Current gate: **RED**. The direct editor and lifecycle-label findings were partly resolved, but an entry into the unavailable edit flow remains visibly misleading.

- **Direct editor controls resolved.** On the live SKU `130200122_`, the edit button is absent and the recommendation explains that adjustment is unavailable and no quantity changed. On the live replenishment route `?code=130200122_`, the single expanded row also has no edit button and displays the same notice. The source now checks capability before showing the editor at `src/components/opus_a/AdjustForm.tsx:69-81`, `SkuCard.tsx:27,41,85`, and `Replenishment.tsx:24,49`.
- **Today lifecycle labels resolved.** The live metric now says **Стоимость рекомендаций**, and the header says **Проверить рекомендации** and links to replenishment. The same text is in `src/components/opus_a/Today.tsx:151,164`.
- **Residual blocker.** Today's proposal card still offers **Изменить количества** at `Today.tsx:87`, linking to replenishment where adjustment is unavailable. Replenishment's lead at `Replenishment.tsx:112` also says a user can open a product to **внести изменения**. For this live backend state, these continue to promise an editing task that cannot be completed. Make these entry labels capability-aware or describe quantity inspection only. The underlying adjustment service remains unavailable; save success is still unverified under this dry-run gate.

Recheck used read-only local browser navigation and DOM inspection on the SKU, filtered replenishment row, and Today page. No mutation request was sent. Browser screenshots in the initial check were returned as tool image bytes; this reviewer did not save or modify screenshot files.

## Final copy recheck

The residual misleading entry is **resolved**. Live Today now shows **Проверить количества** on the remaining proposal card and links to `/opus_a/replenishment?supplier=IEK`; source: `src/components/opus_a/Today.tsx:87`. Live replenishment now says **Проверьте количества. Откройте товар, чтобы увидеть расчёт.**; source: `src/components/opus_a/Replenishment.tsx:112`. Neither promises an edit that the unavailable service cannot save.

Current **Gate: YELLOW**. The two observed UI issues have been addressed. Quantity adjustment remains explicitly unavailable in this backend state, and this dry run did not verify approval, export, save success, or persistence. The gate can be reconsidered when those flows are exercised under an authorized mutation test.

## Bounded acceptance evidence review

Current **Gate: YELLOW**. I found no new unresolved interface defect in the scoped source. The new shared Today snapshot is owned by `src/components/opus_a/Shell.tsx:75` and consumed by `Today.tsx:134`, removing the duplicate page request. `RunHistory.tsx:21,28-29` labels its action **Пересчитать всё**, posts empty scope, and labels the resulting history entry **Все поставщики**. The adjusted-quantity editor remains capability gated, consistent with the accepted unavailable backend state.

I read `tests/e2e/opus_a.spec.ts`, `check.log`, and `contrast.json`. The deterministic check log ends at **227 passed, 0 failed, 6 skipped, 6 externally unverified**. All ten recorded scoped text/color pairs in `contrast.json` meet the stated 4.5 minimum. The earlier Playwright JSON records **10 passed, 1 timed out**; the timed-out adjustment fixture is superseded in the newer, deliberately interrupted run, where that contract test passed. The earlier run also records a passing *real local* prepare → approve → CSV/XLSX export flow. Adjustment success and EKT presentation use intercepted contract responses in the test source, so they are not evidence of a live backend capability.

At this review's close, the restarted 14-test Playwright process was still running and its final JSON had not replaced the interrupted artifact. The interrupted artifact's 3 failures and 8 skipped tests cannot be treated as a final result. A clean completed run remains the exact acceptance gap; the reviewer did not launch tests, access the database, or issue mutation requests.
