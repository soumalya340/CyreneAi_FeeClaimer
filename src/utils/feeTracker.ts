import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoolAccount = any;

export interface FeeMetrics {
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
}

export interface PoolInfo {
  publicKey: PublicKey;
  baseMint?: PublicKey;
  quoteMint?: PublicKey;
  creator?: PublicKey;
}

export class FeeTracker {
  private client: DynamicBondingCurveClient;

  constructor(connection: Connection) {
    this.client = new DynamicBondingCurveClient(connection, "confirmed");
  }

  async getPoolByBaseMint(baseMintAddress: string): Promise<PoolInfo> {
    try {
      const pool = await this.client.state.getPoolByBaseMint(baseMintAddress);
      if (!pool) {
        throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
      }
      return {
        publicKey: pool.publicKey,
        baseMint: (pool.account as PoolAccount)?.baseMint,
        quoteMint: (pool.account as PoolAccount)?.quoteMint,
        creator: (pool.account as PoolAccount)?.creator,
      };
    } catch (error) {
      console.error("Failed to get pool by base mint:", error);
      throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
    }
  }

  async getPoolFeeMetrics(poolAddress: string): Promise<FeeMetrics> {
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

  async claimFees(
    poolAddress: string,
    wallet: { publicKey: PublicKey }
  ): Promise<string> {
    try {
      const poolPublicKey = new PublicKey(poolAddress);

      console.log("Claiming Fee...");
      console.log("Pool:", poolPublicKey.toString());
      console.log("Fee claimer:", wallet.publicKey.toString());
      console.log("Payer:", wallet.publicKey.toString());

      const transaction = await this.client.partner.claimPartnerTradingFee({
        pool: poolPublicKey,
        feeClaimer: wallet.publicKey,
        payer: wallet.publicKey,
        maxBaseAmount: new BN(0),
        maxQuoteAmount: new BN(1000000000), // FOR 1 SOL
      });

      console.log("Transaction created...");
      const { blockhash } = await this.client.connection.getLatestBlockhash(
        "confirmed"
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Note: In a real implementation, you would need to sign the transaction
      // This requires access to the wallet's private key or a proper wallet adapter
      // For now, we'll return the transaction for the wallet adapter to handle
      throw new Error(
        "Transaction created but requires wallet signing. Please implement proper wallet integration."
      );
    } catch (error) {
      console.error("Failed to claim fees:", error);
      throw new Error(
        `Failed to claim fees for pool: ${poolAddress}. ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
