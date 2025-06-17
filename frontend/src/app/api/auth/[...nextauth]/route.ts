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
      // 初次登入時，user 物件會存在
      if (account && user) {
          // 【關鍵日誌】確認從 authorize 傳來的 user 物件內容
          console.log('--- [JWT-CREDENTIALS] User object received:', JSON.stringify(user, null, 2));
  
          // 回傳一個全新的物件，取代原本的 token
          return {
              ...token, // 保留原始 token 的 iat, exp 等屬性
              accessToken: user.access_token,
              refreshToken: user.refresh_token,
              user: user.user,
          };
      }
  
      // 對於後續的請求 (user 物件不存在時)，直接回傳從 cookie 來的 token
      // 這樣就不會觸發 user is undefined 的錯誤
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