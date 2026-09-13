// The claims we put INSIDE every JWT we sign. `sub` = "subject" (the user id,
// JWT-standard name), `type` distinguishes access vs refresh tokens so each
// can only be used at the endpoint meant for it.
export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}