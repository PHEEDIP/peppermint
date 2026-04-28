import bcrypt from "bcrypt";
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const DEFAULT_BACKUP_CODES = 8;

function getIssuer() {
  return process.env.TWO_FACTOR_ISSUER || "Peppermint";
}

function getWindow() {
  const configured = Number(process.env.TWO_FACTOR_WINDOW || "1");
  return Number.isNaN(configured) ? 1 : configured;
}

function getStep() {
  const configured = Number(process.env.TWO_FACTOR_STEP_SECONDS || "30");
  return Number.isNaN(configured) ? 30 : configured;
}

function configureAuthenticator() {
  authenticator.options = {
    ...(authenticator.options || {}),
    step: getStep(),
    window: getWindow(),
  };
}

export function normalizeTotpCode(code: string) {
  return code.replace(/\s|-/g, "");
}

export async function buildSetupArtifacts(email: string) {
  configureAuthenticator();
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, getIssuer(), secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export function verifyTotpToken(secret: string, token: string) {
  configureAuthenticator();
  return authenticator.verify({ secret, token: normalizeTotpCode(token) });
}

export function generateBackupCodes(total = DEFAULT_BACKUP_CODES) {
  return Array.from({ length: total }, () => {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export async function hashBackupCodes(codes: string[]) {
  return Promise.all(
    codes.map((code) => bcrypt.hash(normalizeTotpCode(code).toUpperCase(), 10))
  );
}

export async function consumeBackupCode(
  storedHashes: string[],
  providedCode: string
): Promise<{ consumed: boolean; remaining: string[] }> {
  const normalized = normalizeTotpCode(providedCode).toUpperCase();

  for (let i = 0; i < storedHashes.length; i++) {
    const isMatch = await bcrypt.compare(normalized, storedHashes[i]);
    if (isMatch) {
      return {
        consumed: true,
        remaining: storedHashes.filter((_, idx) => idx !== i),
      };
    }
  }

  return {
    consumed: false,
    remaining: storedHashes,
  };
}
