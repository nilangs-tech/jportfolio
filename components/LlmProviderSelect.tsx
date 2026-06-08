"use client";

export type Provider = "openai" | "anthropic" | "manual";

export default function LlmProviderSelect({ value, onChange }: { value: Provider; onChange: (p: Provider) => void }) {
  return (
    <select
      className="search-input"
      style={{ width: "auto" }}
      value={value}
      onChange={(e) => onChange(e.target.value as Provider)}
    >
      <option value="anthropic">Anthropic / Claude</option>
      <option value="openai">OpenAI / ChatGPT</option>
      <option value="manual">No LLM / Manual</option>
    </select>
  );
}
