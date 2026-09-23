// Seam (L2a implements). Decimal strings at 2 dp; KZT default; never JS floats in domain code.
export type Currency = "KZT" | "CNY" | "USD" | "RUB";
export interface MoneyJSON { amount: string; currency: Currency }
export class Money {
  private constructor(public readonly amount: string, public readonly currency: Currency) {}
  static of(amount: string | number, currency: Currency = "KZT"): Money { return new Money(String(amount), currency); }
  add(_o: Money): Money { throw new Error("domain pending"); }
  sub(_o: Money): Money { throw new Error("domain pending"); }
  mul(_k: string | number): Money { throw new Error("domain pending"); }
  allocate(_n: number): Money[] { throw new Error("domain pending"); }
  toJSON(): MoneyJSON { return { amount: this.amount, currency: this.currency }; }
}
