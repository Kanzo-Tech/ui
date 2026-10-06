/**
 * Renew an access token with a minute left on it rather than after it dies.
 *
 * The window pays for two things at once: the flight time of the request we are about to send, and
 * the clock skew between this server and the one that will validate the token. A minute covers
 * both on every deployment anyone has run; going to zero means shipping tokens that expire in the
 * air, and going large means renewing constantly on a realm with a five-minute token.
 */
export const DEFAULT_RENEW_WITHIN = 60;
