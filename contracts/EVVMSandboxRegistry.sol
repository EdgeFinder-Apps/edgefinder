// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract EVVMSandboxRegistry {
    uint256 public constant EVVM_ID = 2;
    address public constant MATE_EVVM_ADDRESS = 0x9902984d86059234c3B6e11D5eAEC55f9627dD0f;
    
    struct SandboxAction {
        string opportunityId;
        bytes32 actionHash;
        uint256 asyncNonce;
        address executor;
        uint256 timestamp;
        string metadata;
    }
    
    uint256 public nextIntentId;
    mapping(uint256 => SandboxAction) public sandboxActions;
    mapping(address => mapping(uint256 => bool)) public usedAsyncNonces;
    
    event SandboxActionRecorded(
        uint256 indexed intentId,
        string opportunityId,
        bytes32 actionHash,
        uint256 asyncNonce,
        address indexed executor,
        uint256 timestamp
    );
    
    function recordX402SandboxAction(
        string memory opportunityId,
        bytes32 actionHash,
        uint256 asyncNonce,
        address user,
        string memory metadata
    ) external returns (uint256) {
        require(!usedAsyncNonces[user][asyncNonce], "Async nonce already used");
        require(bytes(opportunityId).length > 0, "Invalid opportunity ID");
        
        usedAsyncNonces[user][asyncNonce] = true;
        
        uint256 intentId = nextIntentId++;
        
        sandboxActions[intentId] = SandboxAction({
            opportunityId: opportunityId,
            actionHash: actionHash,
            asyncNonce: asyncNonce,
            executor: msg.sender,
            timestamp: block.timestamp,
            metadata: metadata
        });
        
        emit SandboxActionRecorded(
            intentId,
            opportunityId,
            actionHash,
            asyncNonce,
            msg.sender,
            block.timestamp
        );
        
        return intentId;
    }
    
    function getSandboxAction(uint256 intentId) external view returns (SandboxAction memory) {
        require(intentId < nextIntentId, "Intent ID does not exist");
        return sandboxActions[intentId];
    }
    
    function isAsyncNonceUsed(address user, uint256 asyncNonce) external view returns (bool) {
        return usedAsyncNonces[user][asyncNonce];
    }
}
