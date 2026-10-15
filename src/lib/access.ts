export const ADMIN_EMAILS = ['amgst99@gmail.com'];
export const isAuthorizedAdmin = (email: string | null | undefined) =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());
