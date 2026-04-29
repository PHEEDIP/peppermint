import { toast } from "@/shadcn/hooks/use-toast";
import { Button } from "@/shadcn/ui/button";
import { getCookie } from "cookies-next";
import useTranslation from "next-translate/useTranslation";
import { useMemo, useState } from "react";
import { useUser } from "../../store/session";

export default function TwoFactorSettings() {
  const token = getCookie("session");
  const { user, fetchUserProfile } = useUser();
  const { t } = useTranslation("peppermint");

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
          title: t("two_factor_start_setup_error_title"),
          description: res.message || t("two_factor_try_again"),
        });
        return;
      }

      setSetupToken(res.setupToken);
      setQrCodeDataUrl(res.qrCodeDataUrl);
      setCode("");
      toast({ title: t("two_factor_setup_started") });
    } finally {
      setLoading(false);
    }
  }

  async function enable2fa() {
    if (!setupToken) {
      toast({
        variant: "destructive",
        title: t("two_factor_start_setup_first_title"),
        description: t("two_factor_start_setup_first_description"),
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
          title: t("two_factor_enable_error_title"),
          description: res.message || t("two_factor_invalid_code_description"),
        });
        return;
      }

      setBackupCodes(res.backupCodes || []);
      setSetupToken("");
      await fetchUserProfile();
      toast({
        title: t("two_factor_enabled"),
        description: t("two_factor_save_backup_codes"),
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
          title: t("two_factor_disable_error_title"),
          description: res.message || t("two_factor_invalid_code_description"),
        });
        return;
      }

      setCode("");
      setBackupCode("");
      setBackupCodes([]);
      await fetchUserProfile();
      toast({ title: t("two_factor_disabled") });
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
          title: t("two_factor_regenerate_error_title"),
          description: res.message || t("two_factor_invalid_code_description"),
        });
        return;
      }

      setBackupCodes(res.backupCodes || []);
      toast({ title: t("two_factor_regenerated") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t("two_factor_authentication")}</h1>
        <p className="text-sm text-foreground">
          {t("two_factor_settings_description")}
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="text-sm">
          {t("status")}: {" "}
          <span className="font-semibold">
            {isEnabled
              ? t("two_factor_status_enabled")
              : t("two_factor_status_disabled")}
          </span>
        </div>

        {!isEnabled ? (
          <>
            {!setupToken ? (
              <Button onClick={startSetup} disabled={loading}>
                {t("two_factor_start_setup")}
              </Button>
            ) : (
              <div className="space-y-3">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={t("two_factor_qr_alt")}
                    className="h-48 w-48"
                  />
                ) : null}
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("two_factor_enter_six_digit_code")}
                  className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <Button onClick={enable2fa} disabled={loading || !code}>
                  {t("two_factor_confirm_and_enable")}
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
              placeholder={t("two_factor_authenticator_code")}
              className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder={t("two_factor_or_backup_code")}
              className="shadow-sm text-foreground bg-transparent block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <div className="flex gap-2">
              <Button onClick={regenerateBackupCodes} disabled={loading}>
                {t("two_factor_regenerate_backup_codes")}
              </Button>
              <Button variant="destructive" onClick={disable2fa} disabled={loading}>
                {t("two_factor_disable")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {backupCodes.length > 0 ? (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">{t("backup_codes")}</h2>
          <p className="text-sm text-foreground">
            {t("two_factor_backup_codes_description")}
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
