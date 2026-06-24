"use client";

import { useState, useEffect } from "react";
import WelcomeAnimation from "@/components/WelcomeAnimation";
import Dashboard from "@/components/Dashboard";
import AuthPage from "@/components/AuthPage";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface UserProfile {
  email: string | null;
  displayName: string | null;
  uid: string;
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    // 1. Check local session cache for instant load or offline mode
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("diya_session");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {
          console.warn("Stale session found");
        }
      }
    }

    // 2. Monitor real Firebase Auth changes if initialized
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const profile = {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            uid: firebaseUser.uid
          };
          setUser(profile);
          localStorage.setItem("diya_session", JSON.stringify(profile));
        } else {
          // Only clear if logged out explicitly or auth says so
          setUser(null);
          localStorage.removeItem("diya_session");
        }
        setAuthChecked(true);
      });
      return () => unsubscribe();
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUser(profile);
    setAnimationDone(false); // Reset animation so they get a high-quality welcome transition!
  };

  const handleLogOut = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (e) {
        console.warn("Firebase signout failed, clearing local session:", e);
      }
    }
    setUser(null);
    localStorage.removeItem("diya_session");
    setAnimationDone(false);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center font-mono text-xs opacity-50 uppercase tracking-widest">
        Syncing Node Session...
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#F9F7F2]">
      {!user ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      ) : !animationDone ? (
        <WelcomeAnimation onComplete={() => setAnimationDone(true)} />
      ) : (
        <Dashboard user={user} onLogOut={handleLogOut} />
      )}
    </main>
  );
}
