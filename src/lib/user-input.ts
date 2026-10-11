import { USER_LEVELS, type UserLevel } from "@/lib/types";

export type UserInput = {
  username: string;
  name: string;
  level: string;
  active: string;
  password: string;
};

export function isUserLevel(value: string): value is UserLevel {
  return (USER_LEVELS as readonly string[]).includes(value);
}

export function validateUserInput(input: UserInput, creating: boolean): string | null {
  const username = input.username.trim();
  const name = input.name.trim();
  if (!username) return "Username wajib diisi";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
    return "Username hanya huruf, angka, titik, garis, atau garis bawah";
  }
  if (!name) return "Nama wajib diisi";
  if (name.length > 255) return "Nama terlalu panjang";
  if (!isUserLevel(input.level)) return "Level tidak valid";
  if (input.active !== "1" && input.active !== "0") return "Status tidak valid";
  if (creating && !input.password) return "Password wajib diisi";
  if (input.password && input.password.length < 4) return "Password minimal 4 karakter";
  if (input.password.length > 72) return "Password terlalu panjang";
  return null;
}
