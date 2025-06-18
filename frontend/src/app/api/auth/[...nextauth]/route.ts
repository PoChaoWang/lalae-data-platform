// route.ts
import NextAuth from "next-auth"
import type { AuthOptions } from "next-auth"
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: AuthOptions = {
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
          console.error('Missing credentials');
          return null;
        }

        try {
          console.log('Attempting login with dj-rest-auth:', { 
            email: credentials.email,
            url: `${process.env.NEXT_PUBLIC_TO_BACKEND_URL}/auth/login/`
          });

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

          console.log('dj-rest-auth response status:', res.status);

          // 讀取回應
          let responseData;
          try {
            responseData = await res.json();
            console.log('dj-rest-auth response data:', responseData);
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
            console.log('Login successful with dj-rest-auth:', responseData);
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
            console.log('--- [JWT] Credentials login detected. Populating Django tokens.');
            token.accessToken = user.access_token;
            token.refreshToken = user.refresh_token;
            token.user = user.user; // 保存從 Django 來的詳細使用者資料
            break;

            case 'google':
              console.log('--- [JWT] Google login. Exchanging token with Django backend.');
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
                      console.log('--- [JWT] Successfully exchanged Google token for Django JWT.');
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
        console.log('SignIn callback:', { user, account: account?.provider });
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