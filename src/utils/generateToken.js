const jwt = require('jsonwebtoken');

/**
 * Generate JWT token
 * @param {string} id  - MongoDB document _id
 * @param {string} type - 'member' | 'group'
 */
const generateToken = (id, type = 'member') => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

module.exports = generateToken;
