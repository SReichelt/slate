module.exports = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  SERVER_PORT: process.env.PORT || 3000,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URL: process.env.GITHUB_REDIRECT_URL,
  MAIL_TRANSPORT_CONFIG: process.env.MAIL_HOST ? {
    host: process.env.MAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
  } : undefined,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_TO: process.env.MAIL_TO
};
