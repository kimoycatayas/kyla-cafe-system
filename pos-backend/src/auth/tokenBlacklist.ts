const revokedAccessTokens = new Set<string>();

export const revokeAccessToken = (token: string) => {
  if (token) {
    revokedAccessTokens.add(token);
  }
};

export const isAccessTokenRevoked = (token: string): boolean =>
  token ? revokedAccessTokens.has(token) : false;

export const clearRevokedAccessToken = (token: string) => {
  if (token) {
    revokedAccessTokens.delete(token);
  }
};
