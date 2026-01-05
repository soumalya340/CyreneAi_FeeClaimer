import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

// Lazy load jito-ts to avoid bundling issues (only load when needed, server-side only)
let jitoCache: any = null;
async function getJito() {
  if (!jitoCache) {
    jitoCache = await import("jito-ts");
  }
  return jitoCache;
}

// Dynamically import spl-token functions to avoid bundling issues
const splToken = await import("@solana/spl-token");

// Dynamically import SPLIT_POSITION_DENOMINATOR to avoid bundling issues
const { SPLIT_POSITION_DENOMINATOR } = await import("@meteora-ag/cp-amm-sdk");

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
  getUserPositionByPool: (
    pool: PublicKey,
    owner: PublicKey
  ) => Promise<Array<{ position: PublicKey; positionNftAccount: PublicKey }>>;
  createPosition: (params: {
    owner: PublicKey;
    payer: PublicKey;
    pool: PublicKey;
    positionNft: PublicKey;
  }) => Promise<Transaction>;
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
   * Helper function to convert signed Transaction to VersionedTransaction
   */
  private convertToVersionedTransaction(
    signedTx: Transaction,
    blockhash: string
  ): VersionedTransaction {
    const messageV0 = new TransactionMessage({
      payerKey: signedTx.feePayer!,
      recentBlockhash: blockhash,
      instructions: signedTx.instructions,
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);

    // Copy signatures from signed transaction
    // The signatures array in Transaction contains { publicKey, signature } objects
    // We need to extract just the signature bytes (filter out null signatures)
    if (signedTx.signatures && signedTx.signatures.length > 0) {
      const signatures = signedTx.signatures
        .filter((sig) => sig.signature !== null)
        .map((sig) => sig.signature!);

      if (signatures.length > 0) {
        versionedTx.signatures = signatures;
      }
    }

    return versionedTx;
  }

  /**
   * Helper function to get random tip account from Jito
   */
  private async getRandomTipAccount(searcherClient: any): Promise<PublicKey> {
    const result = await searcherClient.getTipAccounts();
    if (!result.ok) {
      throw new Error(`Failed to get tip accounts: ${result.error}`);
    }
    const accounts = result.value;
    return new PublicKey(accounts[Math.floor(Math.random() * accounts.length)]);
  }

  /**
   * Split position to another user using Jito bundles for atomic transactions
   * Based on split-position-to-user.js but uses wallet adapter and Jito bundles
   */
  async splitPositionToUser(
    poolAddress: string,
    recipientAddress: string,
    splitPercent: number,
    wallet: WalletAdapter,
    blockEngineUrl?: string
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!wallet.signTransaction) {
      throw new Error("Wallet does not support transaction signing");
    }

    try {
      const cpAmm = await this.getCpAmm();
      console.log("\n🚀 ═══════════════════════════════════════════════════");
      console.log("    SPLIT POSITION TO USER - STARTING (JITO BUNDLES)");
      console.log("═══════════════════════════════════════════════════════\n");
      console.log("[DammV2Manager] Starting position split...");
      console.log("  Pool:", poolAddress);
      console.log("  Recipient:", recipientAddress);
      console.log("  Split %:", splitPercent);

      // Lazy load jito-ts (server-side only)
      const jito = await getJito();
      const { searcher, bundle } = jito;

      // Setup Jito client
      const jitoUrl = blockEngineUrl || "mainnet.block-engine.jito.wtf";
      console.log("  Jito Block Engine:", jitoUrl);

      // For Jito, we need a keypair to authenticate, but we can't use the wallet's private key
      // So we'll create a temporary keypair just for Jito authentication
      // Note: In production, you might want to handle this differently
      const jitoKeypair = Keypair.generate();
      const searcherClient = searcher.searcherClient(jitoUrl, jitoKeypair);
      console.log("✅ Jito client initialized");

      // Get tip account
      const tipAccount = await this.getRandomTipAccount(searcherClient);
      console.log("✅ Tip account:", tipAccount.toString());

      const recipientPubkey = new PublicKey(recipientAddress);
      const poolPubkey = new PublicKey(poolAddress);

      // ═══════════════════════════════════════════════════════════
      // STEP 1: Get existing position for main wallet
      // ═══════════════════════════════════════════════════════════

      console.log("\n📋 STEP 1: Getting existing position for main wallet...");

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
      console.log(
        "✅ Position NFT Account:",
        firstPositionNftAccount.toString()
      );

      // ═══════════════════════════════════════════════════════════
      // STEP 2: Create second position for main wallet (same owner!)
      // ═══════════════════════════════════════════════════════════

      console.log("\n📤 STEP 2: Creating second position for main wallet...");

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

      // ═══════════════════════════════════════════════════════════
      // Send first bundle: Create position
      // ═══════════════════════════════════════════════════════════

      console.log("\n📦 Sending first bundle: Create position...");
      const { blockhash: blockhash1 } =
        await this.connection.getLatestBlockhash("finalized");

      createPositionTx.recentBlockhash = blockhash1;
      createPositionTx.feePayer = wallet.publicKey;

      // Sign with wallet first
      const walletSignedCreateTx = await wallet.signTransaction(
        createPositionTx
      );

      // Convert to VersionedTransaction
      const createPositionVersioned = this.convertToVersionedTransaction(
        walletSignedCreateTx,
        blockhash1
      );

      // Partial sign with keypair
      createPositionVersioned.sign([secondPositionNftKeypair]);

      // Create bundle with create position transaction
      // Note: Tip transactions are optional for Jito bundles
      // We can add them later if needed, but for now we'll keep it simple
      const bundle1 = new bundle.Bundle([createPositionVersioned], 5);
      const bundleResult1 = await searcherClient.sendBundle(bundle1);

      if (!bundleResult1.ok) {
        throw new Error(
          `Failed to send create position bundle: ${bundleResult1.error}`
        );
      }

      console.log("✅ First bundle sent:", bundleResult1.value);
      console.log(
        `   Bundle: https://jito.io/bundle/${bundleResult1.value}?cluster=mainnet-beta`
      );

      // Wait for position to be indexed
      console.log("   ⏳ Waiting for position to be indexed...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

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
        `\n📤 STEP 3: Splitting ${splitPercent}% to second position (same owner - 1 signature!)...`
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

      // ═══════════════════════════════════════════════════════════
      // STEP 4: Get NFT mint and check its type
      // ═══════════════════════════════════════════════════════════

      console.log("\n📤 STEP 4: Getting NFT mint and checking type...");

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

      // 1. Derive the destination Address using the CORRECT program
      const destinationAta = await splToken.getAssociatedTokenAddress(
        nftMint,
        recipientPubkey,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID, // ← Use the correct program!
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log(
        "   ✅ Destination ATA (Derived):",
        destinationAta.toString()
      );

      // 2. Check if it already exists
      const accountInfo = await this.connection.getAccountInfo(destinationAta);
      const destinationExists = accountInfo !== null;
      console.log("   ✅ Destination ATA exists on-chain:", destinationExists);

      // 3. Prepare ATA creation transaction if needed
      let createAtaTx: Transaction | null = null;
      if (!destinationExists) {
        console.log("   ⚠️  ATA missing. Will create ATA account in bundle...");
        createAtaTx = new Transaction().add(
          splToken.createAssociatedTokenAccountInstruction(
            wallet.publicKey, // Payer (Main Wallet pays the rent)
            destinationAta, // The new ATA address
            recipientPubkey, // Owner of the new ATA
            nftMint, // The Mint
            TOKEN_2022_PROGRAM_ID, // ← Use the correct program!
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 6: Transfer NFT (with correct program!)
      // ═══════════════════════════════════════════════════════════

      console.log("\n📤 STEP 6: Preparing NFT transfer transaction...");

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

      console.log("✅ Transfer transaction prepared");

      // ═══════════════════════════════════════════════════════════
      // STEP 7: Bundle remaining transactions and send via Jito
      // ═══════════════════════════════════════════════════════════

      console.log(
        "\n📦 STEP 7: Bundling remaining transactions and sending via Jito..."
      );

      // Get fresh blockhash
      const { blockhash } = await this.connection.getLatestBlockhash(
        "finalized"
      );

      // Set blockhash and feePayer for all transactions
      splitTx.recentBlockhash = blockhash;
      splitTx.feePayer = wallet.publicKey;

      if (createAtaTx) {
        createAtaTx.recentBlockhash = blockhash;
        createAtaTx.feePayer = wallet.publicKey;
      }

      transferTx.recentBlockhash = blockhash;
      transferTx.feePayer = wallet.publicKey;

      // Sign all transactions with wallet
      const signedSplitTx = await wallet.signTransaction(splitTx);
      const signedTransferTx = await wallet.signTransaction(transferTx);
      const signedCreateAtaTx = createAtaTx
        ? await wallet.signTransaction(createAtaTx)
        : null;

      // Convert all transactions to VersionedTransaction
      const transactions: VersionedTransaction[] = [];

      // 1. Split position transaction
      const splitVersioned = this.convertToVersionedTransaction(
        signedSplitTx,
        blockhash
      );
      transactions.push(splitVersioned);
      console.log("✅ Added split position transaction to bundle");

      // 2. Create ATA transaction (if needed)
      if (signedCreateAtaTx) {
        const createAtaVersioned = this.convertToVersionedTransaction(
          signedCreateAtaTx,
          blockhash
        );
        transactions.push(createAtaVersioned);
        console.log("✅ Added create ATA transaction to bundle");
      }

      // 3. Transfer NFT transaction
      const transferVersioned = this.convertToVersionedTransaction(
        signedTransferTx,
        blockhash
      );
      transactions.push(transferVersioned);
      console.log("✅ Added transfer NFT transaction to bundle");

      // Create and send bundle
      const jitoBundle = new bundle.Bundle(transactions, 5);

      const bundleResult = await searcherClient.sendBundle(jitoBundle);
      if (!bundleResult.ok) {
        throw new Error(`Failed to send bundle: ${bundleResult.error}`);
      }

      const bundleId = bundleResult.value;
      console.log("\n  ✅ Bundle sent successfully!");
      console.log(`   ✅ Bundle ID: ${bundleId}`);
      console.log(
        `   ✅ Bundle: https://jito.io/bundle/${bundleId}?cluster=mainnet-beta`
      );

      console.log("\n ═══════════════════════════════════════════════════");
      console.log("    SUCCESS! POSITION SPLIT AND TRANSFERRED!");
      console.log("═══════════════════════════════════════════════════════");
      console.log(`   Recipient: ${recipientPubkey.toString()}`);
      console.log(`   Split Amount: ${splitPercent}%`);
      console.log(`   Position NFT: ${nftMint.toString()}`);
      console.log("═══════════════════════════════════════════════════════\n");

      return bundleId;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      console.error("\n ═══════════════════════════════════════════════════");
      console.error("    ERROR OCCURRED!");
      console.error("═══════════════════════════════════════════════════════");
      console.error("   Message:", errorMessage);
      if (errorStack) {
        console.error("   Stack:", errorStack);
      }
      console.error(
        "═══════════════════════════════════════════════════════\n"
      );
      throw new Error(`Failed to split position: ${errorMessage}`);
    }
  }
}
