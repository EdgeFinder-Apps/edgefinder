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
}
