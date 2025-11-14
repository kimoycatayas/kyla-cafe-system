export type UnauthorizedHandler = () => Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

export const getUnauthorizedHandler = () => unauthorizedHandler;
