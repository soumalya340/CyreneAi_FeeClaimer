import { Connection, Keypair } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
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

    // console.log("Claiming Fee...");

    console.log("Unclaimed fees:");

    const metrics = await client.state.getPoolFeeMetrics(
      pool.publicKey.toString()
    );

    // Convert BN values to readable strings
    const readableMetrics = {
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

    console.log(
      "Metrics (readable):",
      JSON.stringify(readableMetrics, null, 2)
    );
  } catch (error) {
    console.error("Failed to claim fee:", error);
    throw error;
  }
}

claimFee();
