/**
 * ReasoningPicker — sets the main model's reasoning effort from the dashboard
 * Chat sidebar, mirroring the desktop app's composer effort radio.
 *
 * The dashboard previously only showed a read-only "Reasoning" capability
 * badge (see ModelInfoCard) with no way to actually choose the effort level —
 * unlike the desktop app, which exposes a radio in its model menu. This closes
 * that parity gap.
 *
 * REST mode saves the profile default for new sessions. A connected native
 * chat uses config.get/config.set to apply the same setting to its live
 * session; without a session ID the backend saves the profile default.
 *
 * Profile scoping: the sidebar passes the chat profile explicitly, so this
 * reads/writes the same config the chat PTY was launched from.
 */

import { Select, SelectOption } from "@nous-research/ui/ui/components/select";
import { Brain } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import type { GatewayClient } from "@/lib/gatewayClient";
import {
  EFFORT_OPTIONS,
  normalizeEffort,
  VALID_EFFORTS,
} from "@/lib/reasoning-effort";

interface ReasoningPickerProps {
  /** Current model string from config — re-reads the saved effort when it
   *  changes (a different model may have been selected). */
  currentModel: string;
  /** Profile whose config should be read/written. */
  profile?: string;
  /** Bumped after the model picker saves, to re-read config in lockstep. */
  refreshKey?: number;
  gw?: Pick<GatewayClient, "request"> | null;
  sessionId?: string;
  disabled?: boolean;
  label?: string;
  /** Called after a successful change. */
  onChanged?: (effort: string) => void;
}

export function ReasoningPicker({
  currentModel,
  profile,
  refreshKey = 0,
  gw,
  sessionId,
  disabled = false,
  label = "reasoning",
  onChanged,
}: ReasoningPickerProps) {
  const [effort, setEffort] = useState("medium");
  const [loadedKey, setLoadedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchKey = JSON.stringify([profile, currentModel, refreshKey, sessionId, Boolean(gw)]);
  const loaded = loadedKey === fetchKey;

  useEffect(() => {
    let active = true;
    const request = gw
      ? gw.request<{ value?: string | null }>("config.get", {
          key: "reasoning", profile, session_id: sessionId,
        }).then((result) => result.value)
      : api.getConfig(profile).then((cfg) =>
          (cfg?.agent as Record<string, unknown> | undefined)?.reasoning_effort,
        );
    void request
      .then((value) => {
        if (!active) return;
        setEffort(normalizeEffort(value));
        setLoadedKey(fetchKey);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => { active = false; };
  }, [fetchKey, gw, profile, sessionId]);

  const onSelect = useCallback(
    (next: string) => {
      if (!loaded || disabled || saving || !VALID_EFFORTS.has(next) || next === effort) return;
      const prev = effort;
      setEffort(next); // optimistic
      setSaving(true);
      // Sparse patch: PUT /api/config deep-merges onto disk, so sending only
      // the edited key never clobbers sibling keys — and never echoes a
      // default-expanded snapshot back over values another surface changed
      // meanwhile (a CLI-pinned auxiliary slot would come back as "auto").
      const request = gw
        ? gw.request("config.set", { key: "reasoning", value: next, profile, session_id: sessionId })
        : api.saveConfig({ agent: { reasoning_effort: next } }, profile);
      void request
        .then(() => {
          setError(null);
          onChanged?.(next);
        })
        .catch((err) => {
          setEffort(prev); // revert on failure
          setError(errorMessage(err));
        })
        .finally(() => setSaving(false));
    },
    [disabled, effort, gw, loaded, onChanged, profile, saving, sessionId],
  );

  return (
    <div role="group" aria-label={label}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-text-tertiary">
          <Brain className="h-3.5 w-3.5" />
          <span className="text-display tracking-wider">{label}</span>
        </div>
        <Select
          className="ml-auto min-w-0"
          disabled={disabled || !loaded || saving}
          onValueChange={onSelect}
          value={effort}
        >
          {EFFORT_OPTIONS.map((opt) => (
            <SelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </SelectOption>
          ))}
        </Select>
      </div>
      {error && <p role="alert" className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
