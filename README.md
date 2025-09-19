# Meteora DBC Fee Claimer

A single-page web application for tracking and claiming fees from Meteora Dynamic Bonding Curve (DBC) pools.

## Features

- **Wallet Connection**: Connect with Phantom, Solflare, or Torus wallets
- **Fee Tracking**: View unclaimed fees for your token pools
- **Fee Claiming**: Claim partner trading fees from your pools
- **Real-time Updates**: Refresh fee data to see current amounts
- **Transaction History**: View transaction signatures and links to Solscan

## How to Use

1. **Connect Your Wallet**: Click the wallet connection button and connect with your preferred Solana wallet

2. **Enter Token Address**: Input the base mint address of your token that was launched on Meteora DBC

3. **Track Fees**: Click "Track Fees" to view your pool information and current unclaimed fees

4. **Claim Fees**: If you have unclaimed fees, click "Claim Fees" to claim them (requires wallet signature)

5. **Monitor**: Use the "Refresh" button to update fee information

## Technical Details

- Built with Next.js 15 and React 19
- Uses Solana Web3.js for blockchain interactions
- Integrates with Meteora DBC SDK
- Supports multiple wallet adapters
- Responsive design with dark mode support

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

The application uses the following environment variables:

- `PRIVATE_KEY`: Your wallet's private key (for server-side operations)

**Note**: For production use, implement proper wallet integration without exposing private keys.

## Supported Wallets

- Phantom
- Solflare
- Torus

## Network

Currently configured for Solana Mainnet using Helius RPC.

## License

MIT
