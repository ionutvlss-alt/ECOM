import { EncryptedVaultEntry } from './types';

export interface AdAccountSecret {
  username: string;
  password: string;
  accountId: string;
  loginUrl: string;
  notes: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 250000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptAdAccount(
  secret: AdAccountSecret,
  masterPassword: string
): Promise<EncryptedVaultEntry> {
  if (!masterPassword) throw new Error('Parola master este obligatorie.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const plaintext = encoder.encode(JSON.stringify(secret));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );

  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptAdAccount(
  entry: EncryptedVaultEntry,
  masterPassword: string
): Promise<AdAccountSecret> {
  if (!masterPassword) throw new Error('Introdu parola master.');

  try {
    const salt = base64ToBytes(entry.salt);
    const iv = base64ToBytes(entry.iv);
    const ciphertext = base64ToBytes(entry.ciphertext);
    const key = await deriveKey(masterPassword, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );

    const parsed = JSON.parse(decoder.decode(decrypted));
    return {
      username: String(parsed.username || ''),
      password: String(parsed.password || ''),
      accountId: String(parsed.accountId || ''),
      loginUrl: String(parsed.loginUrl || ''),
      notes: String(parsed.notes || ''),
    };
  } catch {
    throw new Error('Parola master este greșită sau datele criptate sunt invalide.');
  }
}
