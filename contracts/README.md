# EVVM Sandbox Contracts

This directory contains smart contracts for the EVVM sandbox integration.

## EVVMSandboxRegistry.sol

A simple EVVM service contract that records x402 dataset refresh actions in a sandbox environment on Sepolia.

### Purpose

This contract acts as a virtual ledger for sandbox actions, allowing users to preview the $1 USDC dataset refresh intent without executing real transactions or moving funds.

### Deployment

**Network**: Sepolia (Ethereum Testnet)  
**EVVM**: MATE Metaprotocol (EVVM ID: 2)  
**EVVM Contract**: `0x9902984d86059234c3B6e11D5eAEC55f9627dD0f`  
**Deployed At**: `0x1ab3AF53DCF61EEeadce08387da85D790AD747d8`

View on Sepolia Etherscan: https://sepolia.etherscan.io/address/0x1ab3AF53DCF61EEeadce08387da85D790AD747d8

To deploy to a different network:

```bash
# Install Foundry if not already installed
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Compile the contract
forge build

# Deploy to Sepolia
forge create --rpc-url $SEPOLIA_RPC_URL \
  --private-key $SEPOLIA_PRIVATE_KEY \
  contracts/EVVMSandboxRegistry.sol:EVVMSandboxRegistry
```

After deployment, add the contract address to your `.env`:
```
EVVM_SANDBOX_REGISTRY_ADDRESS=0x1ab3AF53DCF61EEeadce08387da85D790AD747d8
```

### Contract Interface

#### recordX402SandboxAction

```solidity
function recordX402SandboxAction(
    string memory opportunityId,
    bytes32 actionHash,
    uint256 asyncNonce,
    address user,
    string memory metadata
) external returns (uint256 intentId)
```

Records a new sandbox action. Returns a unique intent ID.

**Parameters**:
- `opportunityId`: Identifier of the arbitrage opportunity
- `actionHash`: Keccak256 hash of the x402 action payload
- `asyncNonce`: Unique nonce for this user (prevents replay)
- `user`: Address of the user initiating the action
- `metadata`: JSON string with additional info (amount, timestamp, etc.)

#### getSandboxAction

```solidity
function getSandboxAction(uint256 intentId) 
    external view returns (SandboxAction memory)
```

Retrieves a sandbox action by its intent ID.

#### isAsyncNonceUsed

```solidity
function isAsyncNonceUsed(address user, uint256 asyncNonce) 
    external view returns (bool)
```

Checks if an async nonce has been used by a specific user.