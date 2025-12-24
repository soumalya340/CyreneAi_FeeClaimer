import {
    Connection,
    PublicKey,
    Transaction,
    sendAndConfirmRawTransaction,
  } from "@solana/web3.js";
  import { 
    DynamicBondingCurveClient, 
    deriveDammV2PoolAddress 
  } from "@meteora-ag/dynamic-bonding-curve-sdk";
  import { CpAmm } from "@meteora-ag/cp-amm-sdk";
  import BN from "bn.js";
  import { createProxiedConnection } from "@/services/proxiedConnection";
  
  export interface WalletAdapter {
    publicKey: PublicKey | null;
    signTransaction?: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  }
  
  // DAMM V2 migration fee addresses (from Meteora documentation)
  // Source: https://docs.meteora.ag/dynamic-bonding-curve/migration-to-damm-v2
  const DAMM_V2_MIGRATION_FEE_ADDRESS: Record<number, string> = {
    0: "7F6dnUcRuyM2TwR8myT1dYypFXpPSxqwKNSFNkxyNESd",
    1: "2nHK1kju6XjphBLbNxpM5XRGFj7p9U8vvNzyZiha1z6k",
    2: "Hv8Lmzmnju6m7kcokVKvwqz7QPmdX9XfKjJsXz8RXcjp",
    3: "2c4cYd4reUYVRAB9kUUkrq55VPyy2FNQ3FDL4o12JXmq",
    4: "AkmQWebAwFvWk55wBoCr5D62C6VVDTzi84NJuD9H7cFD",
    5: "DbCRBj8McvPYHJG1ukj8RE15h2dCNUdTAESG49XpQ44u",
    6: "A8gMrEPJkacWkcb3DGwtJwTe16HktSEfvwtuDh2MCtck",
  };
  
  // Quote mint addresses
  const QUOTE_MINTS: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  };
  
  // Token Program IDs
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  
  export class FeeClaimerClient {
    private dbcClient: DynamicBondingCurveClient;
    private cpAmmClient: CpAmm;
    private connection: Connection;
  
    constructor(connection?: Connection) {
      const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    
      if (heliusApiKey) {
        const endpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
        console.log("💰 [FeeClaimerClient] Using direct Helius RPC:", endpoint);
        this.connection = new Connection(endpoint, "confirmed");
      } else {
        // fallback to whatever connection is passed (e.g., from createProxiedConnection)
        this.connection = connection || new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        console.warn("⚠️ [FeeClaimerClient] Helius API key not found — using default mainnet RPC.");
      }
    
      this.dbcClient = new DynamicBondingCurveClient(this.connection, "confirmed");
      this.cpAmmClient = new CpAmm(this.connection);
    }
    
    
    /**
     * Derive the DAMM V2 pool address for a graduated pool
     * This calculates the deterministic address based on config and token mints
     */
    async deriveDammV2PoolAddress(
      configAddress: string,
      tokenAMint: string,
      tokenBMint: string
    ): Promise<string> {
      try {
        console.log("[FeeClaimerClient] Deriving DAMM V2 pool address...");
        console.log("  Config:", configAddress);
        console.log("  Token A:", tokenAMint);
        console.log("  Token B:", tokenBMint);
  
        // Get pool config to determine DAMM migration config
        const poolConfig = await this.dbcClient.state.getPoolConfig(
          new PublicKey(configAddress)
        );
  
        console.log("  Migration Fee Option:", poolConfig.migrationFeeOption);
  
        const dammConfigAddress = DAMM_V2_MIGRATION_FEE_ADDRESS[poolConfig.migrationFeeOption];
  
        if (!dammConfigAddress) {
          throw new Error(
            `Unknown migration fee option: ${poolConfig.migrationFeeOption}. ` +
            `Available options: ${Object.keys(DAMM_V2_MIGRATION_FEE_ADDRESS).join(", ")}`
          );
        }
  
        // Derive the DAMM V2 pool address
        const dammV2PoolAddress = deriveDammV2PoolAddress(
          new PublicKey(dammConfigAddress),
          new PublicKey(tokenAMint),
          new PublicKey(tokenBMint)
        );
  
        console.log("  ✅ Derived DAMM V2 address:", dammV2PoolAddress.toString());
  
        return dammV2PoolAddress.toString();
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to derive DAMM V2 pool address:", error);
        throw new Error(
          `Failed to derive DAMM V2 pool address: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  
    /**
     * Get pool information by base mint address
     * Returns DBC pool address and metadata
     */
    async getPoolByBaseMint(baseMintAddress: string): Promise<{
      publicKey: PublicKey;
      account: {
        baseMint?: PublicKey;
        quoteMint?: PublicKey;
        creator?: PublicKey;
        config?: PublicKey;
      };
    }> {
      try {
        const pool = await this.dbcClient.state.getPoolByBaseMint(baseMintAddress);
        if (!pool) {
          throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
        }
        return pool;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to get pool by base mint:", error);
        throw new Error(`Pool not found for base mint: ${baseMintAddress}`);
      }
    }
  
    /**
     * Get pool config information including partner/feeClaimer address
     * Returns the partner address that can claim platform fees
     */
    async getPoolPartnerInfo(poolAddress: string): Promise<{
      partnerAddress: string | null;
      configAddress: string | null;
    }> {
      try {
        const poolPublicKey = new PublicKey(poolAddress);
        const pool = await this.dbcClient.state.getPool(poolPublicKey);
        
        if (!pool) {
          throw new Error(`Pool not found: ${poolAddress}`);
        }
  
        // Get the config to find the partner/feeClaimer
        const configAddress = pool.config?.toString() || null;
        
        if (configAddress) {
          const poolConfig = await this.dbcClient.state.getPoolConfig(
            new PublicKey(configAddress)
          );
          
          // The feeClaimer in the config is the partner address
          const partnerAddress = poolConfig.feeClaimer?.toString() || null;
          
          console.log("[FeeClaimerClient] Pool Partner Info:");
          console.log("  Config:", configAddress);
          console.log("  Partner/FeeClaimer:", partnerAddress);
          
          return {
            partnerAddress,
            configAddress,
          };
        }
        
        return {
          partnerAddress: null,
          configAddress: null,
        };
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to get pool partner info:", error);
        return {
          partnerAddress: null,
          configAddress: null,
        };
      }
    }
  
    /**
     * Check if a wallet address is the partner/feeClaimer for a pool
     * Only the partner can claim platform fees
     */
    async isPartnerForPool(poolAddress: string, walletAddress: PublicKey): Promise<boolean> {
      try {
        const { partnerAddress } = await this.getPoolPartnerInfo(poolAddress);
        
        if (!partnerAddress) {
          console.warn("[FeeClaimerClient] No partner address found for pool");
          return false;
        }
        
        const isPartner = partnerAddress === walletAddress.toBase58();
        console.log(`[FeeClaimerClient] Wallet ${walletAddress.toBase58()} is partner: ${isPartner}`);
        
        return isPartner;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to check partner status:", error);
        return false;
      }
    }
  
    /**
     * Get DBC pool fee metrics
     * Only works for DBC pools (non-graduated)
     */
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
        const metrics = await this.dbcClient.state.getPoolFeeMetrics(poolAddress);
  
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
        console.error("[FeeClaimerClient] Failed to get pool fee metrics:", error);
        throw new Error(`Failed to get fee metrics for pool: ${poolAddress}`);
      }
    }
  
    /**
     * Get DBC pool curve progress (0.0 to 1.0)
     * Only works for DBC pools
     */
    async getPoolCurveProgress(poolAddress: string): Promise<number> {
      try {
        const poolPublicKey = new PublicKey(poolAddress);
        const progress = await this.dbcClient.state.getPoolCurveProgress(poolPublicKey);
        return progress;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to get pool curve progress:", error);
        throw new Error(`Failed to get pool progress for pool: ${poolAddress}`);
      }
    }
  
    /**
     * Get user positions in a DAMM V2 pool
     */
    async getUserPositionsInDammPool(
      dammPoolAddress: string,
      walletAddress: PublicKey
    ) {
      try {
        const poolPublicKey = new PublicKey(dammPoolAddress);
        const positions = await this.cpAmmClient.getUserPositionByPool(
          poolPublicKey,
          walletAddress
        );
        return positions;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to get user positions:", error);
        return [];
      }
    }
  
    /**
     * Claim creator trading fees from DBC pool
     * Use DBC pool address, NOT DAMM pool address
     */
    async claimCreatorTradingFee(
      dbcPoolAddress: string,
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
        const poolPublicKey = new PublicKey(dbcPoolAddress);
  
        console.log("[FeeClaimerClient] Claiming Creator Trading Fee...");
        console.log("  DBC Pool:", poolPublicKey.toString());
        console.log("  Creator:", wallet.publicKey.toString());
  
        const baseAmount = maxBaseAmount ? new BN(maxBaseAmount) : new BN(0);
        const quoteAmount = maxQuoteAmount
          ? new BN(maxQuoteAmount)
          : new BN(1000000000);
  
        const transaction = await this.dbcClient.creator.claimCreatorTradingFee({
          creator: wallet.publicKey,
          payer: wallet.publicKey,
          pool: poolPublicKey,
          maxBaseAmount: baseAmount,
          maxQuoteAmount: quoteAmount,
          receiver: receiver || undefined,
          tempWSolAcc: tempWSolAcc || undefined,
        });
  
        const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
  
        const signedTransaction = await wallet.signTransaction(transaction);
  
        const signature = await sendAndConfirmRawTransaction(
          this.connection,
          signedTransaction.serialize(),
          { commitment: "confirmed" }
        );
  
        console.log("[FeeClaimerClient] Claim creator fee successfully!");
        console.log(`  Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`);
  
        return signature;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to claim creator fee:", error);
        throw new Error(
          `Failed to claim creator fees: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  
    /**
     * Claim position fees from a graduated DAMM V2 pool
     * Use DAMM pool address, NOT DBC pool address
     * 
     * FIXED: Now uses the correct token program IDs from the pool state
     */
    async claimPositionFee(
      dammPoolAddress: string,
      positionAddress: string,
      positionNftAccount: string,
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
  
      try {
        const poolPublicKey = new PublicKey(dammPoolAddress);
        const positionPublicKey = new PublicKey(positionAddress);
        const positionNftPublicKey = new PublicKey(positionNftAccount);
  
        console.log("[FeeClaimerClient] Claiming Position Fee (DAMM V2)...");
        console.log("  DAMM Pool:", poolPublicKey.toString());
        console.log("  Position:", positionPublicKey.toString());
        console.log("  Owner:", wallet.publicKey.toString());
  
        // Fetch pool state to get correct token program IDs
        const poolState = await this.cpAmmClient.fetchPoolState(poolPublicKey);
        if (!poolState) {
          throw new Error("Pool state not found");
        }
  
        console.log("  Pool state retrieved");
        console.log("  Token A Mint:", poolState.tokenAMint.toString());
        console.log("  Token B Mint:", poolState.tokenBMint.toString());
  
        // Get token account info to determine which program owns the mints
        const tokenAInfo = await this.connection.getAccountInfo(poolState.tokenAMint);
        const tokenBInfo = await this.connection.getAccountInfo(poolState.tokenBMint);
  
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
        const transaction = await this.cpAmmClient.claimPositionFee({
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
  
        const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
  
        const signedTransaction = await wallet.signTransaction(transaction);
  
        const signature = await sendAndConfirmRawTransaction(
          this.connection,
          signedTransaction.serialize(),
          { commitment: "confirmed" }
        );
  
        console.log("[FeeClaimerClient] ✅ Claim position fee successfully!");
        console.log(`  Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`);
  
        return signature;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to claim position fee:", error);
        throw new Error(
          `Failed to claim position fees: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  
    /**
     * Claim partner trading fees from DBC pool
     * Only the designated partner/feeClaimer wallet can call this
     * 
     * @param poolAddress - The DBC pool address
     * @param wallet - The wallet adapter (must be the partner wallet)
     * @param maxBaseAmount - Maximum base token amount to claim (optional)
     * @param maxQuoteAmount - Maximum quote token (SOL) amount to claim (optional)
     * @param skipValidation - Skip partner validation (use with caution, default: false)
     */
    async claimPartnerTradingFee(
      poolAddress: string,
      wallet: WalletAdapter,
      maxBaseAmount?: string,
      maxQuoteAmount?: string,
      skipValidation: boolean = false
    ): Promise<string> {
      if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
      }
  
      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }
  
      try {
        const poolPublicKey = new PublicKey(poolAddress);
  
        console.log("[FeeClaimerClient] Claiming Partner Fee...");
        console.log("  Pool:", poolPublicKey.toString());
        console.log("  Fee claimer:", wallet.publicKey.toString());
  
        // Validate that the connected wallet is the partner for this pool
        if (!skipValidation) {
          const isPartner = await this.isPartnerForPool(poolAddress, wallet.publicKey);
          
          if (!isPartner) {
            const { partnerAddress } = await this.getPoolPartnerInfo(poolAddress);
            throw new Error(
              `Only the designated partner can claim platform fees. ` +
              `Expected partner: ${partnerAddress || 'unknown'}, ` +
              `Connected wallet: ${wallet.publicKey.toBase58()}`
            );
          }
          
          console.log("  ✅ Partner validation passed");
        } else {
          console.log("  ⚠️ Partner validation skipped");
        }
  
        const baseAmount = maxBaseAmount ? new BN(maxBaseAmount) : new BN(0);
        const quoteAmount = maxQuoteAmount
          ? new BN(maxQuoteAmount)
          : new BN(1000000000);
  
        console.log("  Max Base Amount:", baseAmount.toString());
        console.log("  Max Quote Amount:", quoteAmount.toString());
  
        const transaction = await this.dbcClient.partner.claimPartnerTradingFee({
          pool: poolPublicKey,
          feeClaimer: wallet.publicKey,
          payer: wallet.publicKey,
          maxBaseAmount: baseAmount,
          maxQuoteAmount: quoteAmount,
        });
  
        const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
  
        const signedTransaction = await wallet.signTransaction(transaction);
  
        const signature = await sendAndConfirmRawTransaction(
          this.connection,
          signedTransaction.serialize(),
          { commitment: "confirmed" }
        );
  
        console.log("[FeeClaimerClient] Claim partner fee successfully!");
        console.log(`  Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`);
  
        return signature;
      } catch (error) {
        console.error("[FeeClaimerClient] Failed to claim partner fee:", error);
        throw new Error(
          `Failed to claim partner fees: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  
    /**
     * Helper: Get quote mint address from symbol
     */
    getQuoteMintAddress(quoteMintSymbol: string): string {
      return QUOTE_MINTS[quoteMintSymbol] || quoteMintSymbol;
    }
  }