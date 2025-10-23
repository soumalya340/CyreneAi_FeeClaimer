import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";

export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

export class FeeClaimer {
  private client: DynamicBondingCurveClient;
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
    this.client = new DynamicBondingCurveClient(connection, "confirmed");
  }

  async claimPartnerTradingFee(
    poolAddress: string,
    wallet: WalletAdapter,
    maxQuoteAmount?: string
  ): Promise<string> {
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

      // Use the provided maxQuoteAmount or default to 1 SOL
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

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash(
        "confirmed"
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction with the wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send and confirm the transaction
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

  async claimCreatorTradingFee(
    poolAddress: string,
    wallet: WalletAdapter,
    maxBaseAmount?: string,
    maxQuoteAmount?: string,
    receiver?: PublicKey | null,
    tempWSolAcc?: PublicKey | null
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!wallet.signTransaction) {
      throw new Error("Wallet does not support transaction signing");
    }

    try {
      const poolPublicKey = new PublicKey(poolAddress);

      console.log("Claiming Creator Trading Fee...");
      console.log("Pool:", poolPublicKey.toString());
      console.log("Creator:", wallet.publicKey.toString());
      console.log("Payer:", wallet.publicKey.toString());

      // Use the provided amounts or default to 1 SOL for quote, 0 for base
      const baseAmount = maxBaseAmount ? new BN(maxBaseAmount) : new BN(0);
      const quoteAmount = maxQuoteAmount
        ? new BN(maxQuoteAmount)
        : new BN(1000000000);

      const transaction = await this.client.creator.claimCreatorTradingFee({
        creator: wallet.publicKey,
        payer: wallet.publicKey,
        pool: poolPublicKey,
        maxBaseAmount: baseAmount,
        maxQuoteAmount: quoteAmount,
        receiver: receiver || undefined,
        tempWSolAcc: tempWSolAcc || undefined,
      });

      console.log("Transaction created...");

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash(
        "confirmed"
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign the transaction with the wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send and confirm the transaction
      const signature = await sendAndConfirmRawTransaction(
        this.connection,
        signedTransaction.serialize(),
        { commitment: "confirmed" }
      );

      console.log("Claim creator fee successfully!");
      console.log(
        `Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`
      );

      return signature;
    } catch (error) {
      console.error("Failed to claim creator fee:", error);
      throw new Error(
        `Failed to claim creator fees: ${
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
    try {
      const metrics = await this.client.state.getPoolFeeMetrics(poolAddress);

      // Convert BN values to readable strings
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
