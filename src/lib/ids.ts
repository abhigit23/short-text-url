import { customAlphabet } from "nanoid";

// Base62 (uppercase + lowercase + digits), URL-safe and typable.
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const CODE_LENGTH = 6;

// ~56 bits of entropy at length 6.
export const shortId = customAlphabet(alphabet, CODE_LENGTH);

type CodeProvider = () => string;
type IsTaken = (code: string) => Promise<boolean>;

/**
 * Generates a unique code that is not already taken, retrying on collision.
 */
export async function generateUniqueCode(
  isTaken: IsTaken,
  provider: CodeProvider = shortId,
  maxAttempts = 5
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = provider();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Failed to generate a unique code");
}
