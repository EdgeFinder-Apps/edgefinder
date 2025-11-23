import { cre, type NodeRuntime } from "@chainlink/cre-sdk";

export type HTTPResponse = {
  statusCode: number;
  body: Uint8Array;
  ok: boolean;
  text: () => string;
  json: () => any;
};

export function makeHttpRequest(
  nodeRuntime: NodeRuntime<any>,
  url: string,
  headers: Record<string, string> = {},
): HTTPResponse {
  const httpClient = new cre.capabilities.HTTPClient();
  
  const resp = httpClient.sendRequest(nodeRuntime, {
    url,
    method: "GET",
    headers,
  }).result();

  let bodyText = "";
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    bodyText = decoder.decode(resp.body);
  } catch (err) {
    nodeRuntime.log?.(`Failed to decode response body from ${url}: ${String(err)} (body length: ${resp.body?.length || 0})`);
  }
  
  return {
    statusCode: resp.statusCode,
    body: resp.body,
    ok: resp.statusCode >= 200 && resp.statusCode < 300,
    text: () => bodyText,
    json: () => {
      if (!bodyText || bodyText.length === 0) {
        throw new Error("Empty response body");
      }
      return JSON.parse(bodyText);
    },
  };
}
