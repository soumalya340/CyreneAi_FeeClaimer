import { PublicKey } from "@solana/web3.js";
import {
  CP_AMM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "./constants";

/**
 * Derive position PDA from pool and NFT mint
 *
 * In Meteora DAMM v2, positions are PDAs derived from:
 * seeds = ["position", pool, nft_mint]
 */
export function derivePositionAddress(
  pool: PublicKey,
  nftMint: PublicKey
): PublicKey {
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), pool.toBuffer(), nftMint.toBuffer()],
    CP_AMM_PROGRAM_ID
  );
  return position;
}

/**
 * Derive Associated Token Account for NFT
 *
 * Meteora DAMM v2 uses Token-2022 for position NFTs
 */
export function derivePositionNftAccount(
  nftMint: PublicKey,
  owner: PublicKey
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/**
 * Get random Jito tip account
 */
export function getRandomTipAccount(tipAccounts: string[]): PublicKey {
  const randomIndex = Math.floor(Math.random() * tipAccounts.length);
  return new PublicKey(tipAccounts[randomIndex]);
}
