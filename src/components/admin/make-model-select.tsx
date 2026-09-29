"use client";

import { useState } from "react";

/** Make → model dependent selects, with a free-text fallback for a model that is not listed yet. */
export function MakeModelSelect({
  makes,
  models,
  defaultMake,
  defaultModel,
}: {
  makes: { id: number; name: string }[];
  models: { id: number; make_id: number; name: string }[];
  defaultMake: number | null;
  defaultModel: number | null;
}) {
  const [make, setMake] = useState<string>(defaultMake ? String(defaultMake) : "");
  const [model, setModel] = useState<string>(defaultModel ? String(defaultModel) : "");
  const options = models.filter((m) => String(m.make_id) === make);

  return (
    <>
      <div>
        <label htmlFor="v-make" className="mb-1.5 block text-sm font-semibold">Make</label>
        <select
          id="v-make"
          name="make_id"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setModel("");
          }}
          className="input"
        >
          <option value="">Choose make…</option>
          {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="v-model" className="mb-1.5 block text-sm font-semibold">Model</label>
        <select id="v-model" name="model_id" value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} className="input">
          <option value="">{make ? "Choose model…" : "Choose a make first"}</option>
          {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          {make && <option value="">— Model not listed —</option>}
        </select>
        {make && !model && (
          <input name="new_model" maxLength={80} placeholder="…or type a new model name" className="input mt-2" aria-label="New model name" />
        )}
      </div>
    </>
  );
}
