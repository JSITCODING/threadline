export interface ProviderInput {
  conversationId: string;
  targetPath: string;
}

export interface ProposalProvider {
  readonly name: "manual" | "openai";
  generate(input: ProviderInput): Promise<string>;
}

export class OpenAiProviderNotImplemented implements ProposalProvider {
  readonly name = "openai" as const;

  async generate(_input: ProviderInput): Promise<string> {
    throw new Error("OpenAI provider is not implemented in v0.1. No network call was made.");
  }
}
