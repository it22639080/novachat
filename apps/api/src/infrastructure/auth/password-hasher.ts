import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export class PasswordHasher {
  hash(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verify(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
