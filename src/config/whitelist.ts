export const WHITELISTED_WALLETS: string[] = [
  // Add your whitelisted wallet addresses here
  // Example addresses - replace with actual authorized wallet addresses
  "7xtnVLHTkLcSXHvfbFFyv1FdTNov3LfP4yFxwYbXotj1",
  "FG75GTSYMimybJUBEcu6LkcNqm7fkga1iMp3v4nKnDQS",
  // Add more wallet addresses as needed
];

export const isWalletWhitelisted = (walletAddress: string | null): boolean => {
  if (!walletAddress) return false;
  return WHITELISTED_WALLETS.includes(walletAddress);
};
