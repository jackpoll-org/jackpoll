"use client";

import { useEffect, useState } from "react";
import { ServerIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import {
  getInstanceUrl,
  instancePickerSupported,
  normalizeInstanceUrl,
  switchToInstance,
} from "@/app/lib/native/instance";
import { useTranslation } from "@/app/i18n/context";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Self-host server switcher shown under the login form (native app only).
 * Renders nothing on the web. Lets the user point the app at a different
 * Jackpoll instance without rebuilding.
 */
export function InstanceBox() {
  const { t } = useTranslation();
  const [supported, setSupported] = useState(false);
  const [current, setCurrent] = useState("");
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!instancePickerSupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
    void getInstanceUrl().then((u) => {
      setCurrent(u);
      setValue(u);
    });
  }, []);

  if (!supported) return null;

  let host = current;
  try {
    host = new URL(current).host;
  } catch {
    // keep raw
  }

  async function connect() {
    const url = normalizeInstanceUrl(value);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setError(t("instance.invalidUrl"));
      return;
    }
    if (parsed.protocol !== "https:") {
      setError(t("instance.httpsRequired"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      // Best-effort reachability — CORS blocks reading cross-origin, so a no-cors
      // ping just confirms the host responds. The navigation is the real check.
      await withTimeout(
        fetch(`${url}/api/auth/oidc-config`, { mode: "no-cors", cache: "no-store" }),
        8000,
      );
    } catch {
      setBusy(false);
      setError(t("instance.unreachable"));
      return;
    }
    await switchToInstance(url); // navigates away to the new instance
  }

  return (
    <div className="mt-6 rounded-lg border bg-muted/30 p-3 text-sm">
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <ServerIcon className="size-4 shrink-0" />
            <span className="truncate">{host}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t("instance.change")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            {t("instance.server")}
          </label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://survey.example.com"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={connect}
              disabled={busy}
              className="flex-1"
            >
              {busy && <Spinner className="size-4" />}
              {t("instance.connect")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue(current);
                setError("");
              }}
              disabled={busy}
            >
              {t("instance.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
