import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb";
import { compare } from "bcryptjs";
import { getDatabase } from "./mongodb";

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise) as any,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        try {
          const db = await getDatabase();
          const user = await db.collection("users").findOne({
            email: credentials.email,
          });

          if (!user || !user.hashedPassword) {
            throw new Error("Invalid credentials");
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.hashedPassword
          );

          if (!isPasswordValid) {
            throw new Error("Invalid credentials");
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            // DO NOT include image here
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
    newUser: "/auth/signup",
  },

  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          id: user.id,
          email: user.email,
          name: user.name,
          provider: account.provider,
          // Explicitly exclude image and other large data
        };
      }

      // Update token on session update (but don't include image)
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        // Never include image in token
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        // DO NOT include image - fetch it separately via /api/users/me
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(`✅ User signed in: ${user.email} via ${account?.provider}`);

      if (isNewUser) {
        try {
          const db = await getDatabase();

          // Create default settings
          await db.collection("userSettings").insertOne({
            userId: user.id || user.email,
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            autoStartBreaks: false,
            autoStartPomodoros: false,
            cameraEnabled: false,
            distractionThreshold: 3,
            pauseOnDistraction: true,
            soundEnabled: true,
            desktopNotifications: true,
            breakReminders: true,
            eyeStrainReminders: true,
            dataRetention: 30,
            localProcessing: true,
            analyticsSharing: false,
            theme: "system",
            reducedMotion: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(`✅ Default settings created for ${user.email}`);
        } catch (error) {
          console.error("Failed to create default settings:", error);
        }
      }
    },

    async signOut({ token }) {
      console.log(`👋 User signed out: ${token.email}`);
    },
  },

  debug: process.env.NODE_ENV === "development",

  secret: process.env.NEXTAUTH_SECRET,
};

export async function getServerAuthSession() {
  const { getServerSession } = await import("next-auth/next");
  return await getServerSession(authOptions);
}
