L9 checkpoint — zero-sum fix
Done: loader, derived series, eval SKUs, 45 world events, provenance, reset test.
Months without positive outgoing lines now have qty_lines=0; line aggregation reuses one statement.
SKU union is 3909 (IEK 3185, SE 724), above the estimated gate; all-file union retained.
Reset test: passed twice in 12.56 s with identical counts and all five eval SKUs.
Undone: final gate queries and closeout.
Resume: check stockouts, season mean, ratios and JSONL; write closeout.
