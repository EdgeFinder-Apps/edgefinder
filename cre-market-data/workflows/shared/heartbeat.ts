import {
  cre,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus,
  type Runtime,
} from "@chainlink/cre-sdk";
import { keccak256, encodeFunctionData, encodeAbiParameters, parseAbiParameters, zeroAddress, type Address } from "viem";

const HEARTBEAT_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "summaryHash", type: "bytes32" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "record",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export type HeartbeatConfig = {
  enabled: boolean;
  chainSelectorName: string;
  contractAddress: string;
  gasLimit: string | number;
};

export type HeartbeatPayload = {
  workflow: string;
  count: number;
  upserted: number;
  timestamp: number;
};

export function sendHeartbeat<Config>(
  runtime: Runtime<Config & { heartbeat?: HeartbeatConfig }>,
  payload: HeartbeatPayload,
): string | null {
  const hb = runtime.config?.heartbeat;
  if (!hb || !hb.enabled) {
    runtime.log("Heartbeat disabled; skipping onchain write");
    return null;
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: hb.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Heartbeat network not found: ${hb.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  
  const summaryString = JSON.stringify({
    w: payload.workflow,
    c: payload.count,
    u: payload.upserted,
    t: payload.timestamp,
  });
  const summaryBytes = new TextEncoder().encode(summaryString);
  const summaryHash = keccak256(summaryBytes);

  // encode data
  const reportData = encodeAbiParameters(
    parseAbiParameters("bytes32 summaryHash, uint256 timestamp"),
    [summaryHash, BigInt(payload.timestamp)]
  );

  // generate signed report
  const reportResponse = runtime.report({
    encodedPayload: hexToBase64(reportData),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result();

  const writeResult = evmClient.writeReport(runtime, {
    receiver: hb.contractAddress as Address,
    report: reportResponse,
    gasConfig: { gasLimit: String(hb.gasLimit) },
  }).result();

  if (writeResult.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Heartbeat tx failed: ${writeResult.txStatus} ${writeResult.errorMessage || ""}`);
  }

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
  runtime.log(`Heartbeat sent: hash=${summaryHash} tx=${txHash}`);
  return txHash;
}
