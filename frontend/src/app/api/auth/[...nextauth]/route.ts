// route.ts
import NextAuth from "next-auth"
import type { AuthOptions } from "next-auth"
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

function isTokenExpired(expiryTime: number | undefined): boolean {
  if (!expiryTime) return true;
  
  // Token refresh test
  // return Date.now() / 1000 > expiryTime - 5;
  return Date.now() / 1000 > expiryTime - 300; 
}

const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt',
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),

    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error('Missing credentials', credentials);
          return null;
        }

        try {
          // console.log('Attempting login with dj-rest-auth:', { 
          //   email: credentials.email,
          //   url: `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/login/`
          // });

          // dj-rest-auth 登入端點
          const res = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/login/`, {
            method: 'POST',
            body: JSON.stringify({
              email: credentials.email,  // 或使用 username
              password: credentials.password,
            }),
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          // console.log('dj-rest-auth response status:', res.status);

          // 讀取回應
          let responseData;
          try {
            responseData = await res.json();
            // console.log('dj-rest-auth response data:', responseData);
          } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            const textResponse = await res.text();
            console.error('Raw response:', textResponse);
            return null;
          }

          // ▼▼▼ DEBUG LOG ▼▼▼
          // console.log('\n--- [AUTHORIZE] STEP 1: Response from Django ---');
          // console.log(responseData);
          // ▲▲▲ DEBUG LOG ▲▲▲

          if (!res.ok) {
            console.error('dj-rest-auth login failed:', {
              status: res.status,
              statusText: res.statusText,
              data: responseData
            });
            return null;
          }
          
          if (responseData && responseData.user) {
            // console.log('Login successful with dj-rest-auth:', responseData);
            const userToReturn = {
              id: responseData.user.pk.toString(),
              email: responseData.user.email,
              name: responseData.user.username,
              user: responseData.user,
              access_token: responseData.access,
              refresh_token: responseData.refresh,
            };
  
            // ▼▼▼ DEBUG LOG ▼▼▼
            // console.log('\n--- [AUTHORIZE] STEP 2: Data returned to JWT Callback ---');
            // console.log(userToReturn);
            // ▲▲▲ DEBUG LOG ▲▲▲
            
            return userToReturn;
            
          } else {
            console.error('Invalid response format from dj-rest-auth:', responseData);
            return null;
          }
        } catch (error) {
          console.error('Login request failed:', error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // 'account' 和 'user' 只在初次登入時可用
      if (account && user) {
        // 判斷登入提供者
        switch (account.provider) {
          
          case 'credentials':
            // 只有當使用帳號密碼登入時，才從 user 物件中提取 Django token
            // console.log('--- [JWT] Credentials login detected. Populating Django tokens.');
            token.accessToken = user.access_token;
            token.refreshToken = user.refresh_token;
            token.user = user.user; // 保存從 Django 來的詳細使用者資料
            break;

            case 'google':
              // console.log('--- [JWT] Google login. Exchanging token with Django backend.');
              try {
                  // 使用你剛剛建立的後端端點
                  const res = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/social-auth/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      // dj-rest-auth 預設接收 access_token，但也可以設定為接收 id_token
                      // 我們傳遞從 Google 拿到的 id_token 給後端
                      body: JSON.stringify({ access_token: account.id_token }),
                  });

                  if (res.ok) {
                      const djangoTokens = await res.json();
                      // console.log('--- [JWT] Successfully exchanged Google token for Django JWT.');
                      // 將後端回傳的 Django JWT 存入 next-auth 的 token
                      token.accessToken = djangoTokens.access;
                      token.refreshToken = djangoTokens.refresh;
                      token.user = djangoTokens.user;
                  } else {
                      const errorData = await res.json();
                      console.error('--- [JWT] Django backend token exchange failed:', errorData);
                  }
              } catch (error) {
                  console.error('--- [JWT] Error during token exchange with backend:', error);
              }
              break;
      }
  }
  // Check if access token is expired and refresh it
  if (token.accessToken && token.refreshToken && isTokenExpired(token.accessTokenExpires)) {
    // console.log('--- [JWT] Access token expired or near expiration. Attempting to refresh.');
    try {
      const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: token.refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshedTokens = await refreshRes.json();
        // console.log('--- [JWT] Token refreshed successfully.');
        token.accessToken = refreshedTokens.access;
        // If your backend rotates refresh tokens, update it here:
        if (refreshedTokens.refresh) {
          token.refreshToken = refreshedTokens.refresh;
        }
        // Token refresh test:
        // token.accessTokenExpires = Date.now() / 1000 + 20;
        // Test
        token.accessTokenExpires = Date.now() / 1000 + (60 * 59);
      } else {
        const errorData = await refreshRes.json();
        console.error('--- [JWT] Failed to refresh token:', errorData);
        const isRefreshTokenInvalid = refreshRes.status === 401 ||
                                          (errorData && errorData.detail && errorData.detail.includes('invalid or expired')) ||
                                          (errorData && errorData.code === 'token_not_valid');

            if (isRefreshTokenInvalid) {
              // console.log('--- [JWT] Refresh token is also invalid or expired. Forcing re-login.');
              // 清除所有 token 和 session 數據，強制重新登入
              token.accessToken = undefined;
              token.refreshToken = undefined;
              token.user = undefined;
              token.accessTokenExpires = undefined;
              token.error = 'RefreshTokenExpired'; // 設定特定錯誤類型，用於前端判斷
            } else {
              // console.log('--- [JWT] Access token refresh failed, but refresh token may still be valid. Requesting page refresh.');
              // 僅 Access Token 刷新失敗，但 Refresh Token 可能仍然有效
              token.accessToken = undefined; // 將 Access Token 設為 undefined，表示它失效了
              token.error = 'Please refresh the page to re-authenticate.'; // 設定前端顯示的錯誤訊息
            }
          }
        } catch (error) {
          console.error('--- [JWT] Error during token refresh request:', error);
          // 網路請求本身失敗，也可能是暫時性問題，建議重新整理
          token.accessToken = undefined;
          token.error = 'Network error during re-authentication. Please refresh the page.';
        }
      }

  return token;
},
    
    async session({ session, token }) {
        // ▼▼▼ DEBUG LOG ▼▼▼
        // console.log('\n--- [SESSION CALLBACK] STEP 5: Token received from JWT Callback ---');
        // console.log(token);
        // ▲▲▲ DEBUG LOG ▲▲▲

        session.user = token.user;
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;

        // ▼▼▼ DEBUG LOG ▼▼▼
        // console.log('\n--- [SESSION CALLBACK] STEP 6: Final session object for client ---');
        // console.log(session);
        // ▲▲▲ DEBUG LOG ▲▲▲

        return session;
    },
    
    async signIn({ user, account, profile }) {
        // console.log('SignIn callback:', { user, account: account?.provider });
        return true;
    },
    
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };