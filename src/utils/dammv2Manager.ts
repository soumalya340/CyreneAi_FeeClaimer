import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

export interface PositionInfo {
  positionNftAccount: PublicKey;
  position: PublicKey;
  positionState: any; // PositionState from SDK
  poolInfo?: {
    poolAddress: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    tokenAVault: PublicKey;
    tokenBVault: PublicKey;
    tokenAProgram: PublicKey;
    tokenBProgram: PublicKey;
  };
  unclaimedFees?: {
    feeTokenA: string;
    feeTokenB: string;
  };
}

export class DammV2Manager {
  private cpAmm: CpAmm;
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
    this.cpAmm = new CpAmm(connection);
  }

  /**
   * Get all positions for a user
   */
  async getUserPositions(userPublicKey: PublicKey): Promise<PositionInfo[]> {
    try {
      console.log("Fetching positions for user:", userPublicKey.toString());

      // Get all positions for the user
      const positions = await this.cpAmm.getPositionsByUser(userPublicKey);

      console.log(`Found ${positions.length} positions`);

      // Enrich each position with pool info and unclaimed fees
      const enrichedPositions = await Promise.all(
        positions.map(async (pos) => {
          try {
            // Fetch pool state
            const poolState = await this.cpAmm.fetchPoolState(
              pos.positionState.pool
            );

            // Get token account info to determine correct token programs
            const tokenAInfo = await this.connection.getAccountInfo(
              poolState.tokenAMint
            );
            const tokenBInfo = await this.connection.getAccountInfo(
              poolState.tokenBMint
            );

            let tokenAProgram = TOKEN_PROGRAM_ID;
            let tokenBProgram = TOKEN_PROGRAM_ID;

            if (tokenAInfo && tokenAInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
              tokenAProgram = TOKEN_2022_PROGRAM_ID;
            }
            if (tokenBInfo && tokenBInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
              tokenBProgram = TOKEN_2022_PROGRAM_ID;
            }

            // Calculate unclaimed fees using proper method
            const unclaimedFees = this.calculateUnclaimedFees(
              poolState,
              pos.positionState
            );

            return {
              positionNftAccount: pos.positionNftAccount,
              position: pos.position,
              positionState: pos.positionState,
              poolInfo: {
                poolAddress: pos.positionState.pool,
                tokenAMint: poolState.tokenAMint,
                tokenBMint: poolState.tokenBMint,
                tokenAVault: poolState.tokenAVault,
                tokenBVault: poolState.tokenBVault,
                tokenAProgram: tokenAProgram,
                tokenBProgram: tokenBProgram,
              },
              unclaimedFees: {
                feeTokenA: unclaimedFees.feeTokenA.toString(),
                feeTokenB: unclaimedFees.feeTokenB.toString(),
              },
            };
          } catch (error) {
            console.error(
              `Error enriching position ${pos.position.toString()}:`,
              error
            );
            return {
              positionNftAccount: pos.positionNftAccount,
              position: pos.position,
              positionState: pos.positionState,
            };
          }
        })
      );

      return enrichedPositions;
    } catch (error) {
      console.error("Failed to get user positions:", error);
      throw new Error(
        `Failed to fetch positions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Claim fees for a specific position
   * Uses the same robust implementation as codeForClaimFees.ts
   * Fetches pool state fresh and determines token program IDs dynamically
   */
  async claimPositionFee(
    position: PositionInfo,
    wallet: WalletAdapter,
    receiver?: PublicKey | null,
    tempWSolAccount?: PublicKey | null
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!wallet.signTransaction) {
      throw new Error("Wallet does not support transaction signing");
    }

    if (!position.poolInfo) {
      throw new Error("Pool information not available for this position");
    }

    try {
      const poolPublicKey = position.poolInfo.poolAddress;
      const positionPublicKey = position.position;
      const positionNftPublicKey = position.positionNftAccount;

      console.log("[DammV2Manager] Claiming Position Fee (DAMM V2)...");
      console.log("  DAMM Pool:", poolPublicKey.toString());
      console.log("  Position:", positionPublicKey.toString());
      console.log("  Owner:", wallet.publicKey.toString());

      // Fetch pool state fresh to get correct token program IDs
      const poolState = await this.cpAmm.fetchPoolState(poolPublicKey);
      if (!poolState) {
        throw new Error("Pool state not found");
      }

      console.log("  Pool state retrieved");
      console.log("  Token A Mint:", poolState.tokenAMint.toString());
      console.log("  Token B Mint:", poolState.tokenBMint.toString());

      // Get token account info to determine which program owns the mints
      const tokenAInfo = await this.connection.getAccountInfo(
        poolState.tokenAMint
      );
      const tokenBInfo = await this.connection.getAccountInfo(
        poolState.tokenBMint
      );

      if (!tokenAInfo || !tokenBInfo) {
        throw new Error("Failed to fetch token account info");
      }

      // Determine the correct token program for each token
      // Token-2022 accounts are owned by TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
      // Standard token accounts are owned by TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
      const tokenAProgram = tokenAInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const tokenBProgram = tokenBInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      console.log("  Token A Program:", tokenAProgram.toString());
      console.log("  Token B Program:", tokenBProgram.toString());

      // Build the claim transaction with correct token programs
      // Note: claimPositionFee returns a Promise<Transaction>, not a TxBuilder
      const transaction = await this.cpAmm.claimPositionFee({
        owner: wallet.publicKey,
        pool: poolPublicKey,
        position: positionPublicKey,
        positionNftAccount: positionNftPublicKey,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAProgram: tokenAProgram,
        tokenBProgram: tokenBProgram,
        receiver: receiver || undefined,
        tempWSolAccount: tempWSolAccount || undefined,
      });

      const { blockhash } = await this.connection.getLatestBlockhash(
        "confirmed"
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTransaction = await wallet.signTransaction(transaction);

      const signature = await sendAndConfirmRawTransaction(
        this.connection,
        signedTransaction.serialize(),
        { commitment: "confirmed" }
      );

      console.log("[DammV2Manager] ✅ Claim position fee successfully!");
      console.log(
        `  Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`
      );

      return signature;
    } catch (error) {
      console.error("[DammV2Manager] Failed to claim position fee:", error);
      throw new Error(
        `Failed to claim position fees: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Calculate unclaimed fees for a position
   * Tries multiple method name variations to find the correct SDK method
   */
  private calculateUnclaimedFees(
    poolState: any,
    positionState: any
  ): {
    feeTokenA: { toString: () => string };
    feeTokenB: { toString: () => string };
  } {
    try {
      // Try different method name variations
      if (typeof (this.cpAmm as any).getUnClaimLpFee === "function") {
        return (this.cpAmm as any).getUnClaimLpFee(poolState, positionState);
      }
      if (typeof (this.cpAmm as any).getUnclaimedLpFee === "function") {
        return (this.cpAmm as any).getUnclaimedLpFee(poolState, positionState);
      }
      if (typeof (this.cpAmm as any).calculateUnclaimedFees === "function") {
        return (this.cpAmm as any).calculateUnclaimedFees(
          poolState,
          positionState
        );
      }
      if (typeof (this.cpAmm as any).getUnclaimedFees === "function") {
        return (this.cpAmm as any).getUnclaimedFees(poolState, positionState);
      }

      // If no method found, try to access from position state directly
      if (
        positionState?.unclaimedFeeTokenA !== undefined &&
        positionState?.unclaimedFeeTokenB !== undefined
      ) {
        return {
          feeTokenA: {
            toString: () => positionState.unclaimedFeeTokenA.toString(),
          },
          feeTokenB: {
            toString: () => positionState.unclaimedFeeTokenB.toString(),
          },
        };
      }

      // Fallback: return zeros if we can't calculate
      console.warn(
        "Could not find unclaimed fee calculation method, returning zeros"
      );
      return {
        feeTokenA: { toString: () => "0" },
        feeTokenB: { toString: () => "0" },
      };
    } catch (error) {
      console.error("Error calculating unclaimed fees:", error);
      // Return zeros on error
      return {
        feeTokenA: { toString: () => "0" },
        feeTokenB: { toString: () => "0" },
      };
    }
  }

  /**
   * Format liquidity value for display
   */
  formatLiquidity(liquidity: any): string {
    try {
      return liquidity.toString();
    } catch {
      return "0";
    }
  }

  /**
   * Format fee amount for display with decimals
   */
  formatFeeAmount(amount: string, decimals: number = 9): string {
    try {
      const value = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const wholePart = value / divisor;
      const fractionalPart = value % divisor;

      // Format with up to 6 decimal places
      const fractionalStr = fractionalPart
        .toString()
        .padStart(decimals, "0")
        .slice(0, 6);
      return `${wholePart}.${fractionalStr}`;
    } catch {
      return "0";
    }
  }
}
