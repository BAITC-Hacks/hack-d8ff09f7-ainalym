import Decimal from "decimal.js";

export type Currency = "KZT" | "CNY" | "USD" | "RUB";
export interface MoneyJSON { amount: string; currency: Currency }

function decimalAmount(value: Decimal): string {
  if (value.isZero()) return "0.00";
  if (value.e > 1000) throw new RangeError("money amount is too large");
  const raw = value.toDecimalPlaces(2).toString();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new RangeError("invalid money amount");
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const digits = whole + fraction;
  const point = whole.length + parseInt(exponent, 10);
  const plain = point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length
    ? `${digits}${"0".repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [integer, cents = ""] = plain.split(".");
  return `${sign}${integer}.${cents.padEnd(2, "0")}`;
}

/** Exact two-decimal money. Allocation gives leftover cents to earlier shares. */
export class Money {
  private constructor(public readonly amount: string, public readonly currency: Currency) {}

  static of(amount: string | number | Decimal, currency: Currency = "KZT"): Money {
    const value = new Decimal(amount);
    if (!value.isFinite() || value.decimalPlaces() > 2) throw new RangeError("money must have at most two decimal places");
    return new Money(decimalAmount(value), currency);
  }

  private sameCurrency(other: Money): void {
    if (this.currency !== other.currency) throw new TypeError("cannot mix currencies");
  }

  add(other: Money): Money {
    this.sameCurrency(other);
    return Money.of(new Decimal(this.amount).plus(other.amount), this.currency);
  }

  sub(other: Money): Money {
    this.sameCurrency(other);
    return Money.of(new Decimal(this.amount).minus(other.amount), this.currency);
  }

  mul(multiplier: string | number | Decimal): Money {
    const product = new Decimal(this.amount).times(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return Money.of(product, this.currency);
  }

  allocate(n: number): Money[] {
    if (!globalThis.Number.isSafeInteger(n) || n < 1) throw new RangeError("allocation count must be a positive integer");
    const cents = new Decimal(this.amount).times(100);
    const magnitude = cents.abs();
    const share = magnitude.div(n).floor();
    const remainder = parseInt(magnitude.mod(n).toString(), 10);
    const sign = cents.isNegative() ? -1 : 1;
    return Array.from({ length: n }, (_, index) =>
      Money.of(share.plus(index < remainder ? 1 : 0).times(sign).div(100), this.currency));
  }

  toJSON(): MoneyJSON { return { amount: this.amount, currency: this.currency }; }
}
