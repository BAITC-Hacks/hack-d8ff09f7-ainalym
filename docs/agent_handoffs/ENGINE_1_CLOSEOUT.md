# ENGINE-1 closeout
1 DONE — `isolates a throwing SKU`: 2 scoped → 1 computed, 1 not computed; Russian exception row.
3 DONE — `uses peer documents for a sparse SKU`: injected 5,000 excluded; self-influenced threshold 25,000 → 50; ETL document p95 tested.
2 DONE — `subtracts an approved unreceived order on the next run`: recommendation drops by 10 units after approval.
8 DONE — `keeps B once and drops zero-need A`: basket 2 → 1 line; B appears once.
6 DONE — `uses metre units, an IEK minimum, and an SE multiple`: 12.1 m need → IEK 13 m, SE 20 m; cable export unit `м`.
4 DONE — `counts only transit due within the horizon`: 4 due units counted, 100 late units excluded; IEK header 30.09 parsed.
5 DONE — `shows raw and corrected demand for the same SKU`: M3 raw 874.469 → corrected 1308.389; 1,591 inferred months labelled separately.
10 DONE — `finishes downstream work with rules when a provider throws`: 1 applied event finishes with 1 rules decision and a current proposal.
7 DONE — `averages completed months starting at first sale`: test history 21 → 4 level months; base rate 10.
Checks: `npm run etl && npm run check` GREEN, 261 passed, 0 failed, 7 externally unverified live checks.
Build: `npm run build` GREEN; existing middleware and dynamic filesystem tracing warnings.
Scope: no deferred items; protected UI directories and main untouched; undated transit remains eligible within the horizon.
Gate: GREEN
