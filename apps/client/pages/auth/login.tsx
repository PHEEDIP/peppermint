import { toast } from "@/shadcn/hooks/use-toast";
import { setCookie } from "cookies-next";
import Link from "next/link";
import { useRouter } from "next/router";
import useTranslation from "next-translate/useTranslation";
import { useEffect, useState } from "react";

export default function Login({}) {
  const router = useRouter();
  const { t } = useTranslation("peppermint");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [step, setStep] = useState<"credentials" | "verify" | "setup">(
    "credentials"
  );
  const [url, setUrl] = useState("");
  const [loginChallengeToken, setLoginChallengeToken] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  function handleLoginSuccess(user: any, token: string) {
    setCookie("session", token);

    if (user.external_user) {
      router.push("/portal");
      return;
    }

    if (user.firstLogin) {
      router.push("/onboarding");
      return;
    }

    router.push("/");
  }

  async function postData() {
    try {
      setStatus("loading");
      await fetch(`/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((res) => res.json())
        .then(async (res) => {
          if (res.twoFactorRequired) {
            setLoginChallengeToken(res.loginChallengeToken);
            setTotpCode("");
            setBackupCode("");
            setUseBackupCode(false);
            setStep("verify");
            return;
          }

          if (res.twoFactorSetupRequired) {
            setSetupToken(res.setupToken);
            setQrCodeDataUrl(res.qrCodeDataUrl);
            setTotpCode("");
            setStep("setup");
            toast({
              title: t("two_factor_authentication_required"),
              description: t("two_factor_setup_prompt"),
            });
            return;
          }

          if (res.user && res.token) {
            handleLoginSuccess(res.user, res.token);
            return;
          }

          toast({
            variant: "destructive",
            title: "Error",
            description:
              "There was an error logging in, please try again. If this issue persists, please contact support.",
          });
        });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Database Error",
        description:
          "This is an issue with the database, please check the docker logs or contact support via discord.",
      });
    } finally {
      setStatus("idle");
    }
  }

  async function verifyTwoFactorCode() {
    try {
      setStatus("loading");
      const payload = useBackupCode
        ? { loginChallengeToken, backupCode }
        : { loginChallengeToken, code: totpCode };

      const res = await fetch(`/api/v1/auth/login/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((response) => response.json());

      if (!res.success || !res.token || !res.user) {
        toast({
          variant: "destructive",
          title: t("two_factor_invalid_code_title"),
          description: t("two_factor_invalid_code_description"),
        });
        return;
      }

      handleLoginSuccess(res.user, res.token);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: t("two_factor_verify_error_description"),
      });
    } finally {
      setStatus("idle");
    }
  }

  async function completeTwoFactorSetup() {
    try {
      setStatus("loading");
      const res = await fetch(`/api/v1/auth/login/2fa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, code: totpCode }),
      }).then((response) => response.json());

      if (!res.success || !res.token || !res.user) {
        toast({
          variant: "destructive",
          title: t("two_factor_invalid_code_title"),
          description: t("two_factor_enable_error_description"),
        });
        return;
      }

      toast({
        title: t("two_factor_enabled"),
        description: t("two_factor_save_backup_codes"),
      });

      if (res.backupCodes?.length) {
        alert(`${t("two_factor_backup_codes_alert")}\n\n${res.backupCodes.join("\n")}`);
      }

      handleLoginSuccess(res.user, res.token);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: t("two_factor_setup_complete_error_description"),
      });
    } finally {
      setStatus("idle");
    }
  }

  async function oidcLogin() {
    await fetch(`/api/v1/auth/check`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.url) {
          setUrl(res.url);
        }
      });
  }

  useEffect(() => {
    oidcLogin();
  }, []);

  useEffect(() => {
    if (router.query.error) {
      toast({
        variant: "destructive",
        title: "Account Error - No Account Found",
        description:
          "It looks like you have tried to use SSO with an account that does not exist. Please try again or contact your admin to get you set up first.",
      });
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          APP ISSUE
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {status === "loading" ? (
          <div className="text-center mr-4">{/* <Loader size={32} /> */}</div>
        ) : (
          <div className="bg-background py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {step === "credentials" && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          postData();
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          postData();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Link
                      href="/auth/forgot-password"
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  <button
                    type="submit"
                    onClick={postData}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    เข้าระบบ
                  </button>

                  {url && (
                    <button
                      type="submit"
                      onClick={() => router.push(url)}
                      className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Sign in with OIDC
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t("two_factor_authentication")}
                </h3>
                <p className="text-sm text-foreground">
                  {t("two_factor_enter_authenticator_code")}
                </p>

                {!useBackupCode ? (
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder={t("two_factor_code_placeholder")}
                    className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder={t("two_factor_backup_code_placeholder")}
                    className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                )}

                <button
                  type="button"
                  className="text-sm text-indigo-600"
                  onClick={() => setUseBackupCode(!useBackupCode)}
                >
                  {useBackupCode
                    ? t("two_factor_use_authenticator_instead")
                    : t("two_factor_use_backup_instead")}
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("credentials");
                      setLoginChallengeToken("");
                    }}
                    className="w-full py-2 px-4 border rounded-md text-sm font-medium"
                  >
                    {t("two_factor_back")}
                  </button>
                  <button
                    type="button"
                    onClick={verifyTwoFactorCode}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    {t("two_factor_verify")}
                  </button>
                </div>
              </div>
            )}

            {step === "setup" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t("two_factor_setup_title")}
                </h3>
                <p className="text-sm text-foreground">
                  {t("two_factor_setup_instructions")}
                </p>

                {qrCodeDataUrl ? (
                  <div className="w-full flex justify-center">
                    <img
                      src={qrCodeDataUrl}
                      alt={t("two_factor_qr_alt")}
                      className="h-48 w-48"
                    />
                  </div>
                ) : null}

                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder={t("two_factor_code_placeholder")}
                  className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />

                <button
                  type="button"
                  onClick={completeTwoFactorSetup}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  {t("two_factor_enable_and_continue")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
