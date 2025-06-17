// frontend/src/next-auth.d.ts

import 'next-auth';
import 'next-auth/jwt';

interface BackendUser {
  pk: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

declare module 'next-auth' {
  interface Session {
    user?: BackendUser;
    accessToken?: string;
    refreshToken?: string;
}
  interface User {
    access_token?: string;
    refresh_token?: string;
    user?: BackendUser;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: BackendUser;
    accessToken?: string;
    refreshToken?: string;
  }
}