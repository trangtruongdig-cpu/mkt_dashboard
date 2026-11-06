// Hàm serverless bắt mọi đường dẫn dưới /api trên Vercel.
// Yêu cầu `nest build` đã chạy trước (xem buildCommand trong vercel.json),
// vì file này nạp mã đã biên dịch trong ../dist.
const { getServerlessHandler } = require("../dist/vercel");

module.exports = async function handler(req, res) {
  const handle = await getServerlessHandler();
  handle(req, res);
};
