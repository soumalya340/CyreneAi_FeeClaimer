// Client-side only fee claimer to reduce server bundle size
import { PublicKey } from "@solana/web3.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transaction = any;

export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Connection = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export class FeeClaimerClient {
  private connection: Connection;
  private client: Client;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async initialize() {
    // Dynamic imports to reduce bundle size
    const { DynamicBondingCurveClient } = await import(
      "@meteora-ag/dynamic-bonding-curve-sdk"
    );
    this.client = new DynamicBondingCurveClient(this.connection, "confirmed");
  }

  async claimPartnerTradingFee(
    poolAddress: string,
    wallet: WalletAdapter,
    maxQuoteAmount?: string
  ): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!wallet.signTransaction) {
      throw new Error("Wallet does not support transaction signing");
    }

    try {
      const poolPublicKey = new PublicKey(poolAddress);

      console.log("Claiming Fee...");
      console.log("Pool:", poolPublicKey.toString());
      console.log("Fee claimer:", wallet.publicKey.toString());
      console.log("Payer:", wallet.publicKey.toString());

      // Dynamic import for BN
      const BN = (await import("bn.js")).default;
      const quoteAmount = maxQuoteAmount
        ? new BN(maxQuoteAmount)
        : new BN(1000000000);

      const transaction = await this.client.partner.claimPartnerTradingFee({
        pool: poolPublicKey,
        feeClaimer: wallet.publicKey,
        payer: wallet.publicKey,
        maxBaseAmount: new BN(0),
        maxQuoteAmount: quoteAmount,
      });

      console.log("Transaction created...");

      const { blockhash } = await this.connection.getLatestBlockhash(
        "confirmed"
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);

      // Dynamic import for sendAndConfirmRawTransaction
      const { sendAndConfirmRawTransaction } = await import("@solana/web3.js");

      const signature = await sendAndConfirmRawTransaction(
        this.connection,
        signedTransaction.serialize(),
        { commitment: "confirmed" }
      );

      console.log("Claim fee successfully!");
      console.log(
        `Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`
      );

      return signature;
    } catch (error) {
      console.error("Failed to claim fee:", error);
      throw new Error(
        `Failed to claim fees: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getPoolByBaseMint(baseMintAddress: string): Promise<{
    publicKey: PublicKey;
    account: {
      baseMint?: PublicKey;
      quoteMint?: PublicKey;
      creator?: PublicKey;
    };
  }> {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const pool = await this.client.state.getPoolByBaseMint(baseMintAddress);
      if (!pool) {
        throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
      }
      return pool;
    } catch (error) {
      console.error("Failed to get pool by base mint:", error);
      throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
    }
  }

  async getPoolFeeMetrics(poolAddress: string): Promise<{
    current: {
      partnerBaseFee: string;
      partnerQuoteFee: string;
      creatorBaseFee: string;
      creatorQuoteFee: string;
    };
    total: {
      totalTradingBaseFee: string;
      totalTradingQuoteFee: string;
    };
  }> {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const metrics = await this.client.state.getPoolFeeMetrics(poolAddress);

      return {
        current: {
          partnerBaseFee: metrics.current.partnerBaseFee.toString(),
          partnerQuoteFee: metrics.current.partnerQuoteFee.toString(),
          creatorBaseFee: metrics.current.creatorBaseFee.toString(),
          creatorQuoteFee: metrics.current.creatorQuoteFee.toString(),
        },
        total: {
          totalTradingBaseFee: metrics.total.totalTradingBaseFee.toString(),
          totalTradingQuoteFee: metrics.total.totalTradingQuoteFee.toString(),
        },
      };
    } catch (error) {
      console.error("Failed to get pool fee metrics:", error);
      throw new Error(`Failed to get fee metrics for pool: ${poolAddress}`);
    }
  }
}
