const sendResponse = (res, result, successStatus = 200) => {
  const { statusCode, ...payload } = result;
  const status = result.success ? successStatus : statusCode || 400;
  return res.status(status).json(payload);
};

const parsePositiveInt = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
};

module.exports = {
  sendResponse,
  parsePositiveInt,
};