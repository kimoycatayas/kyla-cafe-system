import argon2 from "argon2";

export const hashPassword = async (plain: string): Promise<string> =>
  argon2.hash(plain, {
    type: argon2.argon2id,
  });

export const verifyPassword = async (
  plain: string,
  hash: string
): Promise<boolean> => argon2.verify(hash, plain);
