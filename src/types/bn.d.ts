declare module "bn.js" {
  export default class BN {
    constructor(value: string | number | BN, base?: number);
    toString(base?: number): string;
    toNumber(): number;
    add(other: BN): BN;
    sub(other: BN): BN;
    mul(other: BN): BN;
    div(other: BN): BN;
    mod(other: BN): BN;
    pow(other: BN): BN;
    eq(other: BN): boolean;
    lt(other: BN): boolean;
    lte(other: BN): boolean;
    gt(other: BN): boolean;
    gte(other: BN): boolean;
    isZero(): boolean;
    isNeg(): boolean;
    neg(): BN;
    abs(): BN;
    and(other: BN): BN;
    or(other: BN): BN;
    xor(other: BN): BN;
    not(): BN;
    shln(bits: number): BN;
    shrn(bits: number): BN;
    maskn(bits: number): BN;
    bincn(bits: number): BN;
    byteLength(): number;
    toArray(endian?: "le" | "be", length?: number): number[];
    toBuffer(endian?: "le" | "be", length?: number): Buffer;
    static isBN(value: unknown): boolean;
    static min(a: BN, b: BN): BN;
    static max(a: BN, b: BN): BN;
  }
}
