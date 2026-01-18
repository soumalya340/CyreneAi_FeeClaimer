import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    PublicKey,
} from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    createInitializeMintInstruction,
    createInitializeMetadataPointerInstruction,
    getMintLen,
    TYPE_SIZE,
    ExtensionType,
    createInitializeInstruction,
    LENGTH_SIZE,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { pack } from "@solana/spl-token-metadata";

export interface TokenMetadata {
    name: string;
    symbol: string;
    uri: string;
    description?: string;
    decimals?: number;
    initialSupply?: number;
}

export interface CreateTokenResult {
    mintAddress: string;
    associatedTokenAccount: string;
    transactionSignature: string;
}

export interface WalletAdapter {
    publicKey: PublicKey;
    signTransaction: <T extends Transaction>(transaction: T) => Promise<T>;
}

export class TokenCreator {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    /**
     * Create a new SPL Token with metadata using Token-2022 program
     */
    async createToken(
        metadata: TokenMetadata,
        wallet: WalletAdapter
    ): Promise<CreateTokenResult> {
        const authority = wallet.publicKey;
        const decimals = metadata.decimals ?? 9;
        const initialSupply = metadata.initialSupply ?? 0;

        // Generate keypair for the mint
        const mint = Keypair.generate();

        // Create the metadata object
        const tokenMetadata = {
            mint: mint.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            additionalMetadata: metadata.description
                ? [["description", metadata.description] as [string, string]]
                : [],
        };

        // Calculate sizes
        const metadataLen = pack(tokenMetadata).length;
        const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
        const spaceWithoutMetadataExtension = getMintLen([
            ExtensionType.MetadataPointer,
        ]);

        // Calculate rent exemption for mint account
        const lamportsForMint =
            await this.connection.getMinimumBalanceForRentExemption(
                spaceWithoutMetadataExtension + metadataLen + metadataExtension
            );

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } =
            await this.connection.getLatestBlockhash();

        // Build instructions for creating mint
        const createMintAccountIx = SystemProgram.createAccount({
            fromPubkey: authority,
            newAccountPubkey: mint.publicKey,
            space: spaceWithoutMetadataExtension,
            lamports: lamportsForMint,
            programId: TOKEN_2022_PROGRAM_ID,
        });

        const initializeMetadataPointerIx =
            createInitializeMetadataPointerInstruction(
                mint.publicKey,
                authority,
                mint.publicKey,
                TOKEN_2022_PROGRAM_ID
            );

        const initializeMintIx = createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            authority,
            authority,
            TOKEN_2022_PROGRAM_ID
        );

        const initializeMetadataIx = createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            mint: mint.publicKey,
            metadata: mint.publicKey,
            mintAuthority: authority,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            updateAuthority: authority,
        });

        // Create transaction for mint creation
        const createMintTx = new Transaction({
            feePayer: authority,
            blockhash,
            lastValidBlockHeight,
        }).add(
            createMintAccountIx,
            initializeMetadataPointerIx,
            initializeMintIx,
            initializeMetadataIx
        );

        // Sign with mint keypair (partial signing)
        createMintTx.partialSign(mint);

        // Sign with wallet
        const signedTx = await wallet.signTransaction(createMintTx);

        // Send transaction with skipPreflight to avoid simulation errors
        const signature = await this.connection.sendRawTransaction(
            signedTx.serialize(),
            {
                skipPreflight: false,
                maxRetries: 3,
            }
        );

        // Confirm transaction
        await this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
        });

        console.log("Mint created:", mint.publicKey.toBase58());

        // If initial supply is specified, mint tokens to the authority
        let associatedTokenAccount = "";
        let mintSignature = signature;

        if (initialSupply > 0) {
            try {
                const result = await this.mintTokens(
                    mint.publicKey,
                    authority,
                    initialSupply,
                    decimals,
                    wallet
                );
                associatedTokenAccount = result.associatedTokenAccount;
                mintSignature = result.signature;
            } catch (err) {
                console.warn("Failed to mint initial supply:", err);
                // Token was created successfully, but minting failed
                // Return the mint creation signature
            }
        }

        return {
            mintAddress: mint.publicKey.toBase58(),
            associatedTokenAccount,
            transactionSignature: mintSignature,
        };
    }

    /**
     * Mint tokens to a wallet
     */
    private async mintTokens(
        mintAddress: PublicKey,
        authority: PublicKey,
        amount: number,
        decimals: number,
        wallet: WalletAdapter
    ): Promise<{ associatedTokenAccount: string; signature: string }> {
        // Wait a bit to ensure the mint account is confirmed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get associated token account
        const associatedTokenAccount = getAssociatedTokenAddressSync(
            mintAddress,
            authority,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Get fresh blockhash for the mint transaction
        const { blockhash, lastValidBlockHeight } =
            await this.connection.getLatestBlockhash("confirmed");

        // Create ATA instruction
        const createATAIx = createAssociatedTokenAccountInstruction(
            authority,
            associatedTokenAccount,
            authority,
            mintAddress,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Mint tokens instruction
        const mintAmount = amount * Math.pow(10, decimals);
        const mintToIx = createMintToInstruction(
            mintAddress,
            associatedTokenAccount,
            authority,
            mintAmount,
            [],
            TOKEN_2022_PROGRAM_ID
        );

        // Create mint transaction
        const mintTx = new Transaction({
            feePayer: authority,
            blockhash,
            lastValidBlockHeight,
        }).add(createATAIx, mintToIx);

        // Sign transaction
        const signedMintTx = await wallet.signTransaction(mintTx);

        // Send transaction with options
        const mintSignature = await this.connection.sendRawTransaction(
            signedMintTx.serialize(),
            {
                skipPreflight: false,
                maxRetries: 3,
            }
        );

        // Confirm transaction
        await this.connection.confirmTransaction({
            signature: mintSignature,
            blockhash,
            lastValidBlockHeight,
        });

        console.log(
            `Minted ${amount} tokens to ${associatedTokenAccount.toBase58()}`
        );

        return {
            associatedTokenAccount: associatedTokenAccount.toBase58(),
            signature: mintSignature,
        };
    }

    /**
     * Get token account balance
     */
    async getTokenBalance(
        tokenAccountAddress: string
    ): Promise<number | null> {
        try {
            const balance = await this.connection.getTokenAccountBalance(
                new PublicKey(tokenAccountAddress)
            );
            return balance.value.uiAmount;
        } catch (error) {
            console.error("Error fetching token balance:", error);
            return null;
        }
    }
}
