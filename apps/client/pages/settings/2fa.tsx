import { toast } from "@/shadcn/hooks/use-toast";
import { Button } from "@/shadcn/ui/button";
import { getCookie } from "cookies-next";
import { useMemo, useState } from "react";
import { useUser } from "../../store/session";

export default function TwoFactorSettings() {
  const token = getCookie("session");
  const { user, fetchUserProfile } = useUser();

  const isEnabled = useMemo(() => !!user?.isTwoFactorEnabled, [user]);

  const [setupToken, setSetupToken] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/auth/2fa/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).then((response) => response.json());

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Unable to start setup",
          description: res.message || "Please try again",
        });
        return;
      }

      setSetupToken(res.setupToken);
      setQrCodeDataUrl(res.qrCodeDataUrl);
      setCode("");
      toast({ title: "2FA setup started" });
    } finally {
      setLoading(false);
    }
  }

  async function enable2fa() {
    if (!setupToken) {
      toast({
        variant: "destructive",
        title: "Start setup first",
        description: "Generate a QR code before enabling 2FA",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/auth/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ setupToken, code }),
      }).then((response) => response.json());

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Unable to enable 2FA",
          description: res.message || "Please verify your code",
        });
        return;
      }

      setBackupCodes(res.backupCodes || []);
      setSetupToken("");
      await fetchUserProfile();
      toast({
        title: "2FA enabled",
        description: "Please save your backup codes.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function disable2fa() {
    try {
      setLoading(true);
      const payload = backupCode
        ? { backupCode }
        : {
            code,
          };

      const res = await fetch(`/api/v1/auth/2fa/disable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }).then((response) => response.json());

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Unable to disable 2FA",
          description: res.message || "Please verify your code",
        });
        return;
      }

      setCode("");
      setBackupCode("");
      setBackupCodes([]);
      await fetchUserProfile();
      toast({ title: "2FA disabled" });
    } finally {
      setLoading(false);
    }
  }

  async function regenerateBackupCodes() {
    try {
      setLoading(true);
      const payload = backupCode
        ? { backupCode }
        : {
            code,
          };
      const res = await fetch(`/api/v1/auth/2fa/backup-codes/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }).then((response) => response.json());

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Unable to regenerate backup codes",
          description: res.message || "Please verify your code",
        });
        return;
      }

      setBackupCodes(res.backupCodes || []);
      toast({ title: "Backup codes regenerated" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Two-factor authentication (2FA)</h1>
        <p className="text-sm text-foreground">
          Protect your account with authenticator app verification.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="text-sm">
          Status: <span className="font-semibold">{isEnabled ? "Enabled" : "Disabled"}</span>
        </div>

        {!isEnabled ? (
          <>
            {!setupToken ? (
              <Button onClick={startSetup} disabled={loading}>
                Start setup
              </Button>
            ) : (
              <div className="space-y-3">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="2FA QR code" className="h-48 w-48" />
                ) : null}
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <Button onClick={enable2fa} disabled={loading || !code}>
                  Confirm and Enable
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Authenticator code"
              className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder="Or backup code"
              className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <div className="flex gap-2">
              <Button onClick={regenerateBackupCodes} disabled={loading}>
                Regenerate Backup Codes
              </Button>
              <Button variant="destructive" onClick={disable2fa} disabled={loading}>
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </div>

      {backupCodes.length > 0 ? (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">Backup Codes</h2>
          <p className="text-sm text-foreground">
            Store these in a secure place. Each code can only be used once.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-mono">
            {backupCodes.map((entry) => (
              <div key={entry} className="p-2 rounded bg-secondary">
                {entry}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
