import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Bọc `scrypt` thành Promise. Không dùng `promisify` vì nó làm mất nạp chồng có tham số
 * `options`, khiến TypeScript báo sai số đối số.
 *
 * Bản bất đồng bộ chứ không phải `scryptSync`: scrypt cố tình chạy chậm, gọi bản đồng bộ
 * sẽ chặn vòng lặp sự kiện và cả API đứng lại trong lúc kiểm tra một mật khẩu.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (loi, derived) => {
      if (loi) reject(loi);
      else resolve(derived);
    });
  });
}

/**
 * Băm mật khẩu bằng scrypt có sẵn trong Node.
 *
 * Không dùng bcrypt/argon2 vì cả hai đều là gói biên dịch native — thêm toolchain vào
 * ảnh Docker và dễ vỡ khi đổi phiên bản Node. scrypt nằm sẵn trong `node:crypto`,
 * là hàm dẫn xuất khoá đúng nghĩa (chậm có chủ đích, tốn bộ nhớ), và được RFC 7914 mô tả.
 *
 * KHÔNG dùng SHA-256 trần cho mật khẩu: nó nhanh, nên dò cạn kiệt cũng nhanh.
 */

/** Tham số scrypt. N càng lớn càng chậm và càng tốn RAM cho kẻ dò mật khẩu. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const PREFIX = "scrypt";

/** Kết quả có dạng `scrypt$N$r$p$<muối base64>$<băm base64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });

  return [PREFIX, N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

/**
 * So mật khẩu người dùng nhập với chuỗi đã băm.
 *
 * Trả về `false` khi chuỗi băm hỏng thay vì ném lỗi — dữ liệu hỏng trong cơ sở dữ liệu
 * không được biến thành lỗi 500 làm lộ thông tin nội bộ ra ngoài.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const phan = stored.split("$");
  if (phan.length !== 6 || phan[0] !== PREFIX) return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = phan as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(saltRaw, "base64");
  const expected = Buffer.from(hashRaw, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });
  } catch {
    // Tham số trong chuỗi băm vượt giới hạn bộ nhớ của scrypt.
    return false;
  }

  // So sánh trong thời gian hằng định: so bằng `===` sẽ dừng ở byte khác nhau đầu tiên,
  // và thời gian phản hồi đó đủ để dò dần từng byte của giá trị băm.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
