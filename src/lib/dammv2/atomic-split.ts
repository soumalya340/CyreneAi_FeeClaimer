import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import {
  CP_AMM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  JITO_TIP_ACCOUNTS,
  DEFAULT_TIP_LAMPORTS,
} from "./constants";
import {
  derivePositionAddress,
  derivePositionNftAccount,
  getRandomTipAccount,
} from "./derive-addresses";
import { JitoClient, NetworkType } from "./jito-client";

// Lazy load CpAmm to avoid SSR issues
let CpAmmClass: any = null;
let SPLIT_POSITION_DENOMINATOR: number = 10000;

async function loadCpAmm() {
  if (!CpAmmClass) {
    const module = await import("@meteora-ag/cp-amm-sdk");
    CpAmmClass = module.CpAmm;
    SPLIT_POSITION_DENOMINATOR = module.SPLIT_POSITION_DENOMINATOR;
  }
  return { CpAmm: CpAmmClass, SPLIT_POSITION_DENOMINATOR };
}

export interface WalletAdapter {
  publicKey: PublicKey | null;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ) => Promise<T[]>;
}

export interface AtomicSplitParams {
  poolAddress: string;
  recipientAddress: string;
  splitPercent: number;
  wallet: WalletAdapter;
  connection: Connection;
  network?: NetworkType;
  tipLamports?: number;
}

export interface AtomicSplitResult {
  bundleId: string;
  bundleUrl: string;
  secondPositionNftMint: string;
  transactions: {
    createPosition: string;
    splitPosition: string;
    createAta: string;
    transferNft: string;
    tip: string;
  };
}

/**
 * Build all transactions for atomic position split
 *
 * This creates 5 transactions in a single bundle:
 * 1. Create second position (owned by sender)
 * 2. Split position (sender → sender's new position)
 * 3. Create recipient's ATA (idempotent - safe if exists)
 * 4. Transfer NFT to recipient
 * 5. Jito tip
 */
export async function buildAtomicSplitBundle(
  params: AtomicSplitParams
): Promise<{
  transactions: Transaction[];
  secondPositionNftKeypair: Keypair;
  signers: Keypair[];
}> {
  const { poolAddress, recipientAddress, splitPercent, wallet, connection } =
    params;

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const { CpAmm, SPLIT_POSITION_DENOMINATOR } = await loadCpAmm();

  const poolPubkey = new PublicKey(poolAddress);
  const recipientPubkey = new PublicKey(recipientAddress);
  const senderPubkey = wallet.publicKey;

  // Initialize CpAmm client
  const cpAmm = new CpAmm(connection);

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Get sender's existing position
  // ═══════════════════════════════════════════════════════════════

  console.log("📋 Step 1: Getting existing position...");

  const senderPositions = await cpAmm.getUserPositionByPool(
    poolPubkey,
    senderPubkey
  );

  if (senderPositions.length === 0) {
    throw new Error("No position found in this pool!");
  }

  const firstPosition = senderPositions[0].position;
  const firstPositionNftAccount = senderPositions[0].positionNftAccount;

  console.log("  ✅ First Position:", firstPosition.toString());

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Generate second position keypair and derive addresses
  // ═══════════════════════════════════════════════════════════════

  console.log("📋 Step 2: Deriving addresses for new position...");

  // Generate new NFT mint keypair
  const secondPositionNftKeypair = Keypair.generate();
  const secondNftMint = secondPositionNftKeypair.publicKey;

  // Derive position PDA (calculated BEFORE creation!)
  const secondPosition = derivePositionAddress(poolPubkey, secondNftMint);

  // Derive sender's ATA for the new NFT
  const secondPositionNftAccount = derivePositionNftAccount(
    secondNftMint,
    senderPubkey
  );

  // Derive recipient's ATA for the NFT
  const recipientNftAccount = derivePositionNftAccount(
    secondNftMint,
    recipientPubkey
  );

  console.log("  ✅ Second NFT Mint:", secondNftMint.toString());
  console.log("  ✅ Second Position PDA:", secondPosition.toString());
  console.log("  ✅ Sender's NFT ATA:", secondPositionNftAccount.toString());
  console.log("  ✅ Recipient's NFT ATA:", recipientNftAccount.toString());

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Build all transactions
  // ═══════════════════════════════════════════════════════════════

  console.log("📋 Step 3: Building transactions...");

  // Transaction 1: Create position
  const createPositionTx = await cpAmm.createPosition({
    owner: senderPubkey,
    payer: senderPubkey,
    pool: poolPubkey,
    positionNft: secondNftMint,
  });

  console.log("  ✅ TX 1: Create position");

  // Transaction 2: Split position
  const numerator = Math.floor(
    (SPLIT_POSITION_DENOMINATOR * splitPercent) / 100
  );

  const splitPositionTx = await cpAmm.splitPosition2({
    firstPositionOwner: senderPubkey,
    secondPositionOwner: senderPubkey, // Same owner for single signature!
    pool: poolPubkey,
    firstPosition: firstPosition,
    firstPositionNftAccount: firstPositionNftAccount,
    secondPosition: secondPosition,
    secondPositionNftAccount: secondPositionNftAccount,
    numerator: numerator,
  });

  console.log("  ✅ TX 2: Split position");

  // Transaction 3: Create recipient's ATA (idempotent - safe if exists!)
  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      senderPubkey, // Payer
      recipientNftAccount, // ATA address
      recipientPubkey, // Owner
      secondNftMint, // Mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  console.log("  ✅ TX 3: Create recipient ATA (idempotent)");

  // Transaction 4: Transfer NFT to recipient
  const transferNftTx = new Transaction().add(
    createTransferCheckedInstruction(
      secondPositionNftAccount, // Source (sender's ATA)
      secondNftMint, // Mint
      recipientNftAccount, // Destination (recipient's ATA)
      senderPubkey, // Authority
      1, // Amount (1 NFT)
      0, // Decimals (0 for NFT)
      [], // No multisig
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("  ✅ TX 4: Transfer NFT");

  // Transaction 5: Jito tip
  const tipAccount = getRandomTipAccount(JITO_TIP_ACCOUNTS);
  const tipTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: tipAccount,
      lamports: params.tipLamports || DEFAULT_TIP_LAMPORTS,
    })
  );

  console.log("  ✅ TX 5: Jito tip →", tipAccount.toString());

  return {
    transactions: [
      createPositionTx,
      splitPositionTx,
      createAtaTx,
      transferNftTx,
      tipTx,
    ],
    secondPositionNftKeypair,
    signers: [secondPositionNftKeypair],
  };
}

/**
 * Execute atomic position split via Jito bundle
 *
 * This is the main function to call from the frontend!
 */
export async function executeAtomicSplit(
  params: AtomicSplitParams
): Promise<AtomicSplitResult> {
  const { wallet, connection, network = "mainnet" } = params;

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  if (!wallet.signAllTransactions) {
    throw new Error("Wallet does not support signAllTransactions");
  }

  console.log("\n🚀 ═══════════════════════════════════════════════════");
  console.log("    ATOMIC POSITION SPLIT - STARTING");
  console.log("═══════════════════════════════════════════════════════\n");

  try {
    // Build all transactions
    const { transactions, secondPositionNftKeypair, signers } =
      await buildAtomicSplitBundle(params);

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");

    console.log("📋 Step 4: Preparing transactions for signing...");
    console.log("  Blockhash:", blockhash);

    // Set blockhash and fee payer for all transactions
    transactions.forEach((tx, i) => {
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey!;
      console.log(`  ✅ TX ${i + 1} prepared`);
    });

    // Partial sign with keypairs (NFT mint keypair for createPosition)
    // Only the first transaction needs the NFT keypair signature
    transactions[0].partialSign(secondPositionNftKeypair);
    console.log("  ✅ Partial signed with NFT keypair");

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Sign all transactions with wallet (single popup!)
    // ═══════════════════════════════════════════════════════════════

    console.log("📋 Step 5: Requesting wallet signatures...");
    console.log("  ⏳ Please approve in your wallet (single popup for all!)");

    const signedTransactions = await wallet.signAllTransactions(transactions);

    console.log("  ✅ All transactions signed!");

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Convert to VersionedTransaction for Jito
    // ═══════════════════════════════════════════════════════════════

    console.log("📋 Step 6: Converting to versioned transactions...");

    const versionedTransactions = signedTransactions.map((signedTx, i) => {
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey!,
        recentBlockhash: blockhash,
        instructions: signedTx.instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      // Copy signatures from the signed transaction
      if (signedTx.signatures && signedTx.signatures.length > 0) {
        const signatures = signedTx.signatures
          .filter((sig) => sig.signature !== null)
          .map((sig) => sig.signature!);

        if (signatures.length > 0) {
          versionedTx.signatures = signatures;
        }
      }

      console.log(`  ✅ TX ${i + 1} converted`);
      return versionedTx;
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Send bundle to Jito
    // ═══════════════════════════════════════════════════════════════

    console.log("📋 Step 7: Sending bundle to Jito...");

    const jitoClient = new JitoClient(network);
    const bundleId = await jitoClient.sendBundle(versionedTransactions);

    const bundleUrl = jitoClient.getBundleUrl(bundleId, network);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("    🎉 SUCCESS! ATOMIC BUNDLE SENT!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Bundle ID: ${bundleId}`);
    console.log(`  Bundle URL: ${bundleUrl}`);
    console.log(`  Recipient: ${params.recipientAddress}`);
    console.log(`  Split: ${params.splitPercent}%`);
    console.log("═══════════════════════════════════════════════════════\n");

    return {
      bundleId,
      bundleUrl,
      secondPositionNftMint: secondPositionNftKeypair.publicKey.toString(),
      transactions: {
        createPosition: "TX 1",
        splitPosition: "TX 2",
        createAta: "TX 3",
        transferNft: "TX 4",
        tip: "TX 5",
      },
    };
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════");
    console.error("    ❌ ERROR OCCURRED!");
    console.error("═══════════════════════════════════════════════════════");
    console.error("  ", error);
    console.error("═══════════════════════════════════════════════════════\n");
    throw error;
  }
}
