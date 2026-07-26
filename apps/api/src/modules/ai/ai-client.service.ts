import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

/**
 * Thin wrapper around the OpenAI SDK. When OPENAI_API_KEY is unset, every
 * method degrades gracefully (embed() returns a deterministic pseudo-vector,
 * chatComplete() returns null) so callers can fall back to extractive /
 * keyword behaviour instead of throwing. This keeps local dev and CI usable
 * without secrets while remaining a drop-in for real API access.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private client: OpenAI | null = null;
  private chatModel: string;
  private embeddingModel: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    this.chatModel = this.config.get<string>("OPENAI_MODEL", "gpt-4o-mini");
    this.embeddingModel = this.config.get<string>("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.logger.warn("OPENAI_API_KEY not set — AI assistant/semantic search will use extractive fallbacks.");
    }
  }

  isEnabled() {
    return this.client !== null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.client) return pseudoEmbedding(text);
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  async chatComplete(systemPrompt: string, userPrompt: string): Promise<string | null> {
    if (!this.client) return null;
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content ?? null;
  }
}

/** Deterministic bag-of-words hashing "embedding" used only when no API key is configured. */
function pseudoEmbedding(text: string, dims = 128): number[] {
  const vector = new Array(dims).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) % dims;
    vector[hash] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
