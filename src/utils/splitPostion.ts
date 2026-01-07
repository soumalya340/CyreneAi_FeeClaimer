import {
    Connection,
    PublicKey,
    Transaction,
    Keypair,
    sendAndConfirmRawTransaction,
  } from "@solana/web3.js";
  
  // Token Program IDs - defined locally to avoid importing from @solana/spl-token
  // which can cause bundling issues with @coral-xyz/anchor
  const TOKEN_2022_PROGRAM_ID = new PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  );
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );
  
  export interface WalletAdapter {
    publicKey: PublicKey | null;
    signTransaction?: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  }
  
  export interface PositionInfo {
    positionNftAccount: PublicKey;
    position: PublicKey;
    positionState: unknown; // PositionState from SDK
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
  
  // Type for CpAmm instance - dynamically imported from @meteora-ag/cp-amm-sdk
  type CpAmmInstance = {
    getUserPositionByPool: (pool: PublicKey, owner: PublicKey) => Promise<Array<{ position: PublicKey; positionNftAccount: PublicKey }>>;
    createPosition: (params: { owner: PublicKey; payer: PublicKey; pool: PublicKey; positionNft: PublicKey }) => Promise<Transaction>;
    splitPosition2: (params: {
      firstPositionOwner: PublicKey;
      secondPositionOwner: PublicKey;
      pool: PublicKey;
      firstPosition: PublicKey;
      firstPositionNftAccount: PublicKey;
      secondPosition: PublicKey;
      secondPositionNftAccount: PublicKey;
      numerator: number;
    }) => Promise<Transaction>;
    fetchPositionState: (position: PublicKey) => Promise<{ nftMint: PublicKey }>;
  };

  export class DammV2Manager {
    private cpAmm: CpAmmInstance | null = null; // CpAmm - loaded dynamically
    private connection: Connection;
    private cpAmmPromise: Promise<CpAmmInstance> | null = null;
  
    constructor(connection: Connection) {
      this.connection = connection;
      // Lazy load the SDK to avoid client-side bundling issues
      this.cpAmmPromise = this.initializeCpAmm();
    }
  
    private async initializeCpAmm(): Promise<CpAmmInstance> {
      if (this.cpAmm) {
        return this.cpAmm;
      }
      const { CpAmm } = await import("@meteora-ag/cp-amm-sdk");
      this.cpAmm = new CpAmm(this.connection) as CpAmmInstance;
      return this.cpAmm;
    }
  
    private async getCpAmm(): Promise<CpAmmInstance> {
      if (!this.cpAmmPromise) {
        this.cpAmmPromise = this.initializeCpAmm();
      }
      return await this.cpAmmPromise;
    }
  
  
    /**
     * Split position to another user
     * Based on split-position-to-user.js but uses wallet adapter instead of keypair
     */
    async splitPositionToUser(
      poolAddress: string,
      recipientAddress: string,
      splitPercent: number,
      wallet: WalletAdapter
    ): Promise<string> {
      if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }

      try {
        const cpAmm = await this.getCpAmm();
        console.log("[DammV2Manager] Starting position split...");
        console.log("  Pool:", poolAddress);
        console.log("  Recipient:", recipientAddress);
        console.log("  Split %:", splitPercent);

        const recipientPubkey = new PublicKey(recipientAddress);
        const poolPubkey = new PublicKey(poolAddress);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Get existing position for main wallet
        // ═══════════════════════════════════════════════════════════

        console.log("📋 STEP 1: Getting existing position for main wallet...");

        const mainPositions = await cpAmm.getUserPositionByPool(
          poolPubkey,
          wallet.publicKey
        );

        if (mainPositions.length === 0) {
          throw new Error("Main wallet has no position in this pool!");
        }

        const firstPosition = mainPositions[0].position;
        const firstPositionNftAccount = mainPositions[0].positionNftAccount;

        console.log("✅ Position Address:", firstPosition.toString());
        console.log("✅ Position NFT Account:", firstPositionNftAccount.toString());

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Create second position for main wallet (same owner!)
        // ═══════════════════════════════════════════════════════════

        console.log("📤 STEP 2: Creating second position for main wallet...");

        const secondPositionNftKeypair = Keypair.generate();
        console.log(
          "  Second Position NFT Keypair:",
          secondPositionNftKeypair.publicKey.toString()
        );

        const createPositionTx = await cpAmm.createPosition({
          owner: wallet.publicKey,
          payer: wallet.publicKey,
          pool: poolPubkey,
          positionNft: secondPositionNftKeypair.publicKey,
        });

        // Set blockhash and feePayer before signing
        const { blockhash } = await this.connection.getLatestBlockhash(
          "confirmed"
        );
        createPositionTx.recentBlockhash = blockhash;
        createPositionTx.feePayer = wallet.publicKey;

        // Sign with wallet first (before partial signing with keypair)
        const walletSignedTx = await wallet.signTransaction(createPositionTx);

        // Now add the keypair signature to the wallet-signed transaction
        walletSignedTx.partialSign(secondPositionNftKeypair);
        const signedCreateTx = walletSignedTx;
        const createSig = await sendAndConfirmRawTransaction(
          this.connection,
          signedCreateTx.serialize(),
          { commitment: "confirmed" }
        );

        console.log("✅ Second position created!");
        console.log(`   TX: https://solscan.io/tx/${createSig}?cluster=mainnet`);

        // Wait a moment for indexing
        console.log("   ⏳ Waiting for position to be indexed...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get all positions again to find the new one
        const allPositions = await cpAmm.getUserPositionByPool(
          poolPubkey,
          wallet.publicKey
        );

        // Find the newly created position (the one that's not the first position)
        const secondPosition = allPositions.find(
          (pos: { position: PublicKey }) =>
            pos.position.toString() !== firstPosition.toString()
        );

        if (!secondPosition) {
          throw new Error("Second position not found after creation!");
        }

        console.log("✅ Second Position:", secondPosition.position.toString());
        console.log(
          "✅ Second Position NFT Account:",
          secondPosition.positionNftAccount.toString()
        );

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Split position (both owned by main wallet - 1 signature!)
        // ═══════════════════════════════════════════════════════════

        console.log(
          `📤 STEP 3: Splitting ${splitPercent}% to second position (same owner - 1 signature!)...`
        );

        // Dynamically import SPLIT_POSITION_DENOMINATOR to avoid bundling issues
        const { SPLIT_POSITION_DENOMINATOR } = await import(
          "@meteora-ag/cp-amm-sdk"
        );
        const numerator = Math.floor(
          (SPLIT_POSITION_DENOMINATOR * splitPercent) / 100
        );

        const splitTx = await cpAmm.splitPosition2({
          firstPositionOwner: wallet.publicKey,
          secondPositionOwner: wallet.publicKey, // ← SAME owner!
          pool: poolPubkey,
          firstPosition: firstPosition,
          firstPositionNftAccount: firstPositionNftAccount,
          secondPosition: secondPosition.position,
          secondPositionNftAccount: secondPosition.positionNftAccount,
          numerator: numerator,
        });

        const { blockhash: splitBlockhash } =
          await this.connection.getLatestBlockhash("confirmed");
        splitTx.recentBlockhash = splitBlockhash;
        splitTx.feePayer = wallet.publicKey;

        const signedSplitTx = await wallet.signTransaction(splitTx);
        const splitSig = await sendAndConfirmRawTransaction(
          this.connection,
          signedSplitTx.serialize(),
          { commitment: "confirmed" }
        );

        console.log("✅ Position split!");
        console.log(`   TX: https://solscan.io/tx/${splitSig}?cluster=mainnet`);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Get NFT mint and check its type
        // ═══════════════════════════════════════════════════════════

        console.log("📤 STEP 4: Getting NFT mint and checking type...");

        // Get the NFT mint from position state
        const secondPositionState = await cpAmm.fetchPositionState(
          secondPosition.position
        );
        const nftMint = secondPositionState.nftMint;

        console.log("  NFT Mint:", nftMint.toString());

        // Source ATA (main wallet's second position NFT account)
        const sourceAta = secondPosition.positionNftAccount;
        console.log("  Source ATA:", sourceAta.toString());

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Create ATA if needed (with correct program!)
        // ═══════════════════════════════════════════════════════════

        console.log("\n📤 STEP 5: Checking/Creating Destination ATA...");

        // Dynamically import spl-token functions to avoid bundling issues
        const splToken = await import("@solana/spl-token");

        // 1. Derive the destination Address using the CORRECT program
        const destinationAta = await splToken.getAssociatedTokenAddress(
          nftMint,
          recipientPubkey,
          false, // allowOwnerOffCurve
          TOKEN_2022_PROGRAM_ID, // ← Use the correct program!
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log("   ✅ Destination ATA (Derived):", destinationAta.toString());

        // 2. Check if it already exists
        const accountInfo = await this.connection.getAccountInfo(destinationAta);
        const destinationExists = accountInfo !== null;
        console.log("   ✅ Destination ATA exists on-chain:", destinationExists);

        // 3. If it doesn't exist, create it first
        let createAtaSig = null;
        if (!destinationExists) {
          console.log("   ⚠️  ATA missing. Creating ATA account...");
          const createAtaTx = new Transaction().add(
            splToken.createAssociatedTokenAccountInstruction(
              wallet.publicKey, // Payer (Main Wallet pays the rent)
              destinationAta, // The new ATA address
              recipientPubkey, // Owner of the new ATA
              nftMint, // The Mint
              TOKEN_2022_PROGRAM_ID, // ← Use the correct program!
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );

          const { blockhash: ataBlockhash } =
            await this.connection.getLatestBlockhash("confirmed");
          createAtaTx.recentBlockhash = ataBlockhash;
          createAtaTx.feePayer = wallet.publicKey;

          const signedAtaTx = await wallet.signTransaction(createAtaTx);
          createAtaSig = await sendAndConfirmRawTransaction(
            this.connection,
            signedAtaTx.serialize(),
            { commitment: "confirmed" }
          );

          console.log("   ✅ ATA creation transaction sent!");
          console.log(
            `   ✅ Create TX: https://solscan.io/tx/${createAtaSig}?cluster=mainnet`
          );

          // 4. Verify the account now exists
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          const verifyInfo = await this.connection.getAccountInfo(destinationAta);
          const nowExists = verifyInfo !== null;
          console.log("   ✅ Destination ATA exists after creation:", nowExists);

          if (!nowExists) {
            throw new Error("ATA account was not created successfully");
          }
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Transfer NFT (with correct program!)
        // ═══════════════════════════════════════════════════════════

        console.log("\n📤 STEP 6: Transferring NFT...");

        const transferTx = new Transaction();

        // Add Transfer Instruction with CORRECT program
        transferTx.add(
          splToken.createTransferCheckedInstruction(
            sourceAta, // Source (my second position ATA)
            nftMint, // Mint
            destinationAta, // Destination (Derived above)
            wallet.publicKey, // Authority
            1, // Amount (1 for NFT)
            0, // Decimals (0 for NFT)
            [], // No multi-signers
            TOKEN_2022_PROGRAM_ID // ← Use the correct program!
          )
        );

        console.log("   🚀 Sending Transfer Transaction...");

        const { blockhash: transferBlockhash } =
          await this.connection.getLatestBlockhash("confirmed");
        transferTx.recentBlockhash = transferBlockhash;
        transferTx.feePayer = wallet.publicKey;

        const signedTransferTx = await wallet.signTransaction(transferTx);
        const transferSig = await sendAndConfirmRawTransaction(
          this.connection,
          signedTransferTx.serialize(),
          { commitment: "confirmed" }
        );

        console.log("\n  ✅ Transfer Transaction Confirmed!");
        console.log(
          `   ✅ TX: https://solscan.io/tx/${transferSig}?cluster=mainnet`
        );

        console.log("    SUCCESS! POSITION SPLIT AND TRANSFERRED!");
        console.log(`   Recipient: ${recipientPubkey.toString()}`);
        console.log(`   Split Amount: ${splitPercent}%`);
        console.log(`   Position NFT: ${nftMint.toString()}`);

        return transferSig;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : "";
        console.error(" Message:", errorMessage);
        if (errorStack) {
          console.error("   Stack:", errorStack);
        }
        throw new Error(`Failed to split position: ${errorMessage}`);
      }
    }
  }
  