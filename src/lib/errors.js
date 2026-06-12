export class McpError extends Error {
  constructor(code, message, data = undefined) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.data = data;
  }
}

export function toJsonRpcError(error) {
  if (error instanceof McpError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  return {
    code: -32603,
    message: error instanceof Error ? error.message : "Internal error",
  };
}
