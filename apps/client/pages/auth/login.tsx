import { toast } from "@/shadcn/hooks/use-toast";
import { setCookie } from "cookies-next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login({}) {
  const router = useRouter();

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
              title: "Two-factor authentication required",
              description: "Set up your authenticator app to continue.",
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
          title: "Invalid code",
          description: "Please verify your 2FA code and try again.",
        });
        return;
      }

      handleLoginSuccess(res.user, res.token);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to verify 2FA. Please try again.",
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
          title: "Invalid code",
          description: "Could not enable 2FA. Please check your code.",
        });
        return;
      }

      toast({
        title: "2FA enabled",
        description: "Save your backup codes in a secure place.",
      });

      if (res.backupCodes?.length) {
        alert(`Backup codes:\n\n${res.backupCodes.join("\n")}`);
      }

      handleLoginSuccess(res.user, res.token);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to complete 2FA setup. Please try again.",
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
          Welcome to Peppermint
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
                    Sign In
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
                  Two-factor authentication
                </h3>
                <p className="text-sm text-foreground">
                  Enter the code from your authenticator app to continue.
                </p>

                {!useBackupCode ? (
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder="Backup code"
                    className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                )}

                <button
                  type="button"
                  className="text-sm text-indigo-600"
                  onClick={() => setUseBackupCode(!useBackupCode)}
                >
                  {useBackupCode
                    ? "Use authenticator code instead"
                    : "Use backup code instead"}
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
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={verifyTwoFactorCode}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

            {step === "setup" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Set up two-factor authentication
                </h3>
                <p className="text-sm text-foreground">
                  Scan this QR code with Google Authenticator or Authy, then
                  enter the 6-digit code.
                </p>

                {qrCodeDataUrl ? (
                  <div className="w-full flex justify-center">
                    <img src={qrCodeDataUrl} alt="2FA QR code" className="h-48 w-48" />
                  </div>
                ) : null}

                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />

                <button
                  type="button"
                  onClick={completeTwoFactorSetup}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  Enable 2FA and Continue
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center flex flex-col space-y-2">
          <span className="font-bold text-foreground">
            Built with 💚 by Peppermint Labs
          </span>
          <a
            href="https://docs.peppermint.sh/"
            target="_blank"
            className="text-foreground"
          >
            Documentation
          </a>
        </div>
      </div>
    </div>
  );
}
