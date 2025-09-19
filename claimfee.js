import {
  PublicKey,
  Connection,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { BN } from "bn.js";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

async function claimFee() {
  try {
    const keypairData = bs58.decode(process.env.PRIVATE_KEY);
    const secretKey = Uint8Array.from(keypairData);
    const wallet = Keypair.fromSecretKey(secretKey);
    console.log("Public key:", wallet.publicKey.toBase58());

    const connection = new Connection(
      "https://mainnet.helius-rpc.com/?api-key=7d2734a8-f8b4-4c00-ade1-4034d4d3eb75",
      "confirmed"
    );
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const pool = await client.state.getPoolByBaseMint(
      "9E53R3NZA9B5RRJjbBGSveYadcKxzjNFmNF3fEtmE8Bw"
    );

    console.log("Claiming Fee...");

    console.log("Pool:", pool.publicKey.toString());
    console.log("Fee claimer:", wallet.publicKey.toString());
    console.log("Payer:", wallet.publicKey.toString());
    const transaction = await client.partner.claimPartnerTradingFee({
      pool: pool.publicKey, // DKSEwzHXNQxyGWWGfEXLKwnMeNUhCSrUSTAWLzmkXCgA
      feeClaimer: wallet.publicKey, // FG75GTSYMimybJUBEcu6LkcNqm7fkga1iMp3v4nKnDQS
      payer: wallet.publicKey, // FG75GTSYMimybJUBEcu6LkcNqm7fkga1iMp3v4nKnDQS
      maxBaseAmount: new BN(0),
      maxQuoteAmount: new BN(1000000000), // FOR 1 SOL
    });

    console.log("Transaction created...");
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: "confirmed" }
    );

    console.log("Claim fee successfully!");
    console.log(
      `Transaction: https://solscan.io/tx/${signature}?cluster=mainnet`
    );
  } catch (error) {
    console.error("Failed to claim fee:", error);
    throw error;
  }
}

claimFee();
