// Cliente LLM agnóstico de provedor (OpenAI ou Gemini). Sem chave configurada, llmAvailable() = false
// e o Téo opera com o motor determinístico embutido.
import OpenAI from "openai";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function provider(): "openai" | "gemini" | null {
  const p = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (p === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function llmAvailable() {
  return provider() !== null;
}

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/** Saída estruturada (JSON Schema). Retorna null em falha para o chamador usar o fallback. */
export async function llmJson<T>(opts: { system: string; messages: ChatMsg[]; schemaName: string; schema: Record<string, unknown>; temperature?: number }): Promise<T | null> {
  const p = provider();
  if (!p) return null;
  try {
    if (p === "openai") {
      const r = await openai().chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: opts.temperature ?? 0.4,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
      });
      const txt = r.choices[0]?.message?.content;
      return txt ? (JSON.parse(txt) as T) : null;
    }
    const txt = await gemini(opts.system + "\n\nResponda SOMENTE com JSON válido seguindo este JSON Schema:\n" + JSON.stringify(opts.schema), opts.messages, true, opts.temperature);
    return txt ? (JSON.parse(txt) as T) : null;
  } catch (e) {
    console.error("[llm] json error", (e as Error).message);
    return null;
  }
}

export async function llmText(opts: { system: string; messages: ChatMsg[]; temperature?: number; maxTokens?: number }): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  try {
    if (p === "openai") {
      const r = await openai().chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: opts.temperature ?? 0.5,
        max_tokens: opts.maxTokens ?? 1200,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
      });
      return r.choices[0]?.message?.content ?? null;
    }
    return await gemini(opts.system, opts.messages, false, opts.temperature);
  } catch (e) {
    console.error("[llm] text error", (e as Error).message);
    return null;
  }
}

async function gemini(system: string, messages: ChatMsg[], jsonMode: boolean, temperature = 0.4): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { temperature, ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
}

/** Transcreve áudio (OpenAI Whisper). Retorna null se indisponível. */
export async function transcribeAudio(url: string, headers?: Record<string, string>): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    const file = new File([blob], "audio.ogg", { type: blob.type || "audio/ogg" });
    const r = await openai().audio.transcriptions.create({ file, model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1", language: "pt" });
    return r.text || null;
  } catch (e) {
    console.error("[llm] transcribe error", (e as Error).message);
    return null;
  }
}

/** Interpreta imagem/documento enviado pelo cliente (visão). */
export async function describeImage(url: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const r = await openai().chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Descreva objetivamente esta imagem enviada por um cliente de imobiliária no WhatsApp. Se for documento (holerite, RG, comprovante), diga o tipo e os dados relevantes para qualificação (renda, nome). Máximo 3 frases." },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
    });
    return r.choices[0]?.message?.content ?? null;
  } catch (e) {
    console.error("[llm] vision error", (e as Error).message);
    return null;
  }
}
