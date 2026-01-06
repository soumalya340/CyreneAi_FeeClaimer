// src/app/api/jito-bundle/route.ts

import { NextRequest, NextResponse } from "next/server";

const JITO_ENDPOINTS = {
  mainnet: "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  devnet: "https://devnet.block-engine.jito.wtf/api/v1/bundles",
};

type NetworkType = "mainnet" | "devnet";

/**
 * POST /api/jito-bundle
 *
 * Server-side Jito bundle submission
 *
 * Why use this instead of client-side?
 * 1. Hide Jito endpoint from frontend (security)
 * 2. Add rate limiting
 * 3. Add logging/analytics
 * 4. Add authentication checks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions, network = "mainnet" } = body as {
      transactions: string[]; // Base64 encoded transactions
      network?: NetworkType;
    };

    // Validate input
    if (
      !transactions ||
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing or invalid transactions array" },
        { status: 400 }
      );
    }

    if (transactions.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 transactions per bundle" },
        { status: 400 }
      );
    }

    // Get Jito endpoint
    const endpoint = JITO_ENDPOINTS[network];
    if (!endpoint) {
      return NextResponse.json({ error: "Invalid network" }, { status: 400 });
    }

    console.log(
      `[Jito Bundle] Submitting ${transactions.length} transactions to ${network}`
    );

    // Send to Jito
    const jitoResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [transactions],
      }),
    });

    const jitoData = await jitoResponse.json();

    // Handle Jito errors
    if (jitoData.error) {
      console.error("[Jito Bundle] Error:", jitoData.error);
      return NextResponse.json(
        { error: jitoData.error.message || "Jito submission failed" },
        { status: 500 }
      );
    }

    // Success!
    const bundleId = jitoData.result;
    console.log(`[Jito Bundle] Success! Bundle ID: ${bundleId}`);

    return NextResponse.json({
      success: true,
      bundleId,
      bundleUrl: `https://explorer.jito.wtf/bundle/${bundleId}?cluster=${
        network === "mainnet" ? "mainnet-beta" : "devnet"
      }`,
    });
  } catch (error) {
    console.error("[Jito Bundle] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jito-bundle?bundleId=xxx&network=mainnet
 *
 * Check bundle status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get("bundleId");
    const network = (searchParams.get("network") || "mainnet") as NetworkType;

    if (!bundleId) {
      return NextResponse.json(
        { error: "Missing bundleId parameter" },
        { status: 400 }
      );
    }

    const endpoint = JITO_ENDPOINTS[network];

    const jitoResponse = await fetch(endpoint, {
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

    const jitoData = await jitoResponse.json();

    if (jitoData.error) {
      return NextResponse.json(
        { error: jitoData.error.message },
        { status: 500 }
      );
    }

    const bundleStatus = jitoData.result?.value?.[0];

    return NextResponse.json({
      bundleId,
      status: bundleStatus?.confirmation_status || "unknown",
      slot: bundleStatus?.slot,
      transactions: bundleStatus?.transactions || [],
    });
  } catch (error) {
    console.error("[Jito Bundle] Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
