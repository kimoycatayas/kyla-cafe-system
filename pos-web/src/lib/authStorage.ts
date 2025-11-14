const ACCESS_TOKEN_KEY = "pos.accessToken";
const REFRESH_TOKEN_KEY = "pos.refreshToken";
const USER_KEY = "pos.user";

export const AUTH_CHANGE_EVENT = "pos.auth.change";

const dispatchAuthChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
};

type StoredUserProfile = {
  businessName: string;
  industry?: string | null;
  fullName?: string | null;
  contactNumber?: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredUser = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  role?: string | null;
  profile?: StoredUserProfile | null;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

const isBrowser = typeof window !== "undefined";

export const authStorage = {
  save({ accessToken, refreshToken, user }: AuthPayload) {
    if (!isBrowser) {
      return;
    }

    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    dispatchAuthChange();
  },
  clear() {
    if (!isBrowser) {
      return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    dispatchAuthChange();
  },
  getAccessToken(): string | null {
    if (!isBrowser) {
      return null;
    }

    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (!isBrowser) {
      return null;
    }

    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser(): StoredUser | null {
    if (!isBrowser) {
      return null;
    }

    const raw = window.localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
};

