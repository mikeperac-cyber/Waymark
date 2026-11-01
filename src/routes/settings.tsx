import { useRef, useState } from "react";
import { Download, Upload, Bell } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { WorkspaceData } from "@/lib/types";
import { parseBackup, serializeWorkspace, downloadTextFile } from "@/lib/backup";
import { today } from "@/lib/dates";
import { bridge, desktopNotify } from "@/lib/platform";
import { PageHeader, Button, ConfirmDialog, inputCls, Field } from "@/components/common";

export function SettingsPage() {
  const { data, updateSettings, replaceAll } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<WorkspaceData | null>(null);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-2xl">
        <section className="mb-8 border-t border-border pt-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Workspace & backups</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {bridge()
              ? "Saved on this computer in the Waymark app data folder."
              : "Saved in this browser on this device."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                downloadTextFile(`waymark-backup-${today()}.json`, serializeWorkspace(data))
              }
            >
              <Download size={16} />
              Export backup
            </Button>
            <Button onClick={() => file.current?.click()}>
              <Upload size={16} />
              Import backup
            </Button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (!selected) return;
              try {
                setPending(parseBackup(await selected.text()));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not import backup");
              }
            }}
          />
        </section>

        <section className="mb-8 border-t border-border pt-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Reminders</h2>
          <label className="mb-3 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={data.settings.notifications}
              onChange={async (e) => {
                const enabled = e.target.checked;
                if (enabled && !bridge() && typeof Notification !== "undefined") {
                  const permission = await Notification.requestPermission();
                  if (permission !== "granted") {
                    toast.error("Notifications are blocked by your browser");
                    return;
                  }
                }
                updateSettings({ notifications: enabled });
              }}
            />
            Desktop notifications
          </label>
          <Button onClick={() => desktopNotify("Waymark", "Your reminders are ready.")}>
            <Bell size={14} />
            Test notification
          </Button>
        </section>

        <section className="mb-8 border-t border-border pt-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Tidying up</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="After merging, the other copy is">
              <select
                className={inputCls}
                value={data.settings.mergeMode}
                onChange={(e) =>
                  updateSettings({ mergeMode: e.target.value === "archive" ? "archive" : "delete" })
                }
              >
                <option value="delete">Deleted</option>
                <option value="archive">Archived</option>
              </select>
            </Field>
            <Field label="Archive completed tasks after">
              <select
                className={inputCls}
                value={data.settings.autoArchiveDoneTasksDays}
                onChange={(e) => updateSettings({ autoArchiveDoneTasksDays: Number(e.target.value) })}
              >
                <option value={0}>Never</option>
                {[7, 14, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {bridge() && (
          <section className="border-t border-border pt-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Desktop</h2>
            <label className="mb-3 flex gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.settings.closeToTray}
                onChange={(e) => {
                  updateSettings({ closeToTray: e.target.checked });
                  bridge()?.setCloseToTray(e.target.checked);
                }}
              />
              Close to system tray
            </label>
            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.settings.launchAtLogin}
                onChange={(e) => {
                  updateSettings({ launchAtLogin: e.target.checked });
                  bridge()?.setLaunchAtLogin(e.target.checked);
                }}
              />
              Start with Windows
            </label>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title="Replace workspace with backup?"
        body="Your current workspace will be replaced. Export a backup first if you want to keep it."
        confirmLabel="Import backup"
        onConfirm={() => {
          if (pending) {
            replaceAll(pending);
            toast.success("Workspace restored");
          }
          setPending(null);
        }}
      />
    </>
  );
}
