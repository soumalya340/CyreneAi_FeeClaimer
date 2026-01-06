import { VersionedTransaction } from "@solana/web3.js";
import { JITO_ENDPOINTS } from "./constants";

export type NetworkType = "mainnet" | "devnet";

export interface JitoBundleResponse {
  jsonrpc: string;
  id: number;
  result?: string; // Bundle ID
  error?: {
    code: number;
    message: string;
  };
}

export interface BundleStatusResponse {
  jsonrpc: string;
  id: number;
  result?: {
    context: { slot: number };
    value: Array<{
      bundle_id: string;
      transactions: string[];
      slot: number;
      confirmation_status: string;
      err?: any;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Jito REST API Client for browser compatibility
 *
 * Unlike jito-ts (which uses gRPC), this works in browsers!
 */
export class JitoClient {
  private endpoint: string;

  constructor(network: NetworkType = "mainnet") {
    this.endpoint = JITO_ENDPOINTS[network];
  }

  /**
   * Send bundle of transactions to Jito
   *
   * @param transactions - Array of signed VersionedTransactions
   * @returns Bundle ID if successful
   */
  async sendBundle(transactions: VersionedTransaction[]): Promise<string> {
    // Convert transactions to base64
    const encodedTransactions = transactions.map((tx) =>
      Buffer.from(tx.serialize()).toString("base64")
    );

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [encodedTransactions],
      }),
    });

    const data: JitoBundleResponse = await response.json();

    if (data.error) {
      throw new Error(`Jito error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new Error("No bundle ID returned from Jito");
    }

    return data.result;
  }

  /**
   * Check bundle status
   *
   * @param bundleId - Bundle ID to check
   * @returns Bundle status
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatusResponse> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBundleStatuses",
        params: [[bundleId]],
      }),
    });

    return response.json();
  }

  /**
   * Get Jito explorer URL for bundle
   */
  getBundleUrl(bundleId: string, network: NetworkType = "mainnet"): string {
    const cluster = network === "mainnet" ? "mainnet-beta" : "devnet";
    return `https://explorer.jito.wtf/bundle/${bundleId}?cluster=${cluster}`;
  }
}
