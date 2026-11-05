
const crypto = require("crypto");

const generateStaffId = () => {
  const randomPart = crypto
    .randomBytes(4)
    .toString("hex")
    .substring(0, 6)
    .toUpperCase();

  return `TEC-${randomPart}`;
};

module.exports = generateStaffId;
