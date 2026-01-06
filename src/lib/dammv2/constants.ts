import { PublicKey } from "@solana/web3.js";

// Meteora DAMM v2 CP-AMM Program ID
// This should match the program ID from @meteora-ag/cp-amm-sdk
// If the SDK exports it, import it instead
export const CP_AMM_PROGRAM_ID = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggLHt1VdC7qFbMv9i4NVp"
);

// Token Program IDs
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// Jito Block Engine Endpoints
export const JITO_ENDPOINTS = {
  mainnet: "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  devnet: "https://devnet.block-engine.jito.wtf/api/v1/bundles",
} as const;

// Jito Tip Accounts (mainnet)
export const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

// Default tip amount in lamports (0.01 SOL = 10,000,000 lamports)
export const DEFAULT_TIP_LAMPORTS = 10_000_000;
