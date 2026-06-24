"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile 
} from "firebase/auth";
import { 
  Sparkles, Mail, Lock, User, Check, ArrowRight, Info, Eye, EyeOff
} from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: (user: { email: string | null; displayName: string | null; uid: string }) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!auth);

  // Smooth floating ambient blob configurations for background animation
  const blobs = [
    {
      id: 1,
      color: "bg-[#F3EFE9]",
      initial: { x: "-20%", y: "-10%", scale: 1 },
      animate: {
        x: ["-20%", "20%", "-10%", "-20%"],
        y: ["-10%", "30%", "10%", "-10%"],
        scale: [1, 1.15, 0.9, 1],
      },
      duration: 18,
    },
    {
      id: 2,
      color: "bg-[#FEF3C7]", // soft amber
      initial: { x: "40%", y: "20%", scale: 0.9 },
      animate: {
        x: ["40%", "-10%", "30%", "40%"],
        y: ["20%", "-20%", "40%", "20%"],
        scale: [0.9, 1.1, 0.85, 0.9],
      },
      duration: 22,
    },
    {
      id: 3,
      color: "bg-[#E0F2FE]", // soft blue
      initial: { x: "-30%", y: "50%", scale: 1.1 },
      animate: {
        x: ["-30%", "10%", "-20%", "-30%"],
        y: ["50%", "10%", "30%", "50%"],
        scale: [1.1, 0.9, 1.2, 1.1],
      },
      duration: 20,
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (!auth) {
      // Offline fallback login mock
      setTimeout(() => {
        const mockUser = {
          email: email || "eleanor@diya.ai",
          displayName: isLogin ? (email.split("@")[0] || "Eleanor") : username || "New User",
          uid: `offline-${Date.now()}`
        };
        // Store session locally
        localStorage.setItem("diya_session", JSON.stringify(mockUser));
        onAuthSuccess(mockUser);
        setIsLoading(false);
      }, 1200);
      return;
    }

    try {
      if (isLogin) {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess({
          email: credential.user.email,
          displayName: credential.user.displayName || credential.user.email?.split("@")[0] || "User",
          uid: credential.user.uid
        });
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, {
          displayName: username || email.split("@")[0]
        });
        onAuthSuccess({
          email: credential.user.email,
          displayName: username || credential.user.email?.split("@")[0] || "User",
          uid: credential.user.uid
        });
      }
    } catch (err: any) {
      console.error("Auth failed:", err);
      setError(err.message || "An authentication error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestBypass = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const guestUser = {
        email: "eleanor@diya.ai",
        displayName: "Eleanor",
        uid: `guest-${Date.now()}`
      };
      localStorage.setItem("diya_session", JSON.stringify(guestUser));
      onAuthSuccess(guestUser);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-[#F9F7F2] overflow-hidden">
      
      {/* SMOOTH AMBIENT ANIMATED BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {blobs.map((blob) => (
          <motion.div
            key={blob.id}
            className={`absolute w-[400px] md:w-[600px] h-[400px] md:h-[600px] rounded-full mix-blend-multiply filter blur-3xl opacity-45 ${blob.color}`}
            initial={blob.initial}
            animate={blob.animate}
            transition={{
              duration: blob.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
        {/* Fine background grid line accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#e1dfda_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
      </div>

      {/* AUTH CARD */}
      <motion.div
        id="auth-card"
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md skeu-card p-8 md:p-10 flex flex-col backdrop-blur-[2px]"
      >
        {/* BRAND IDENTITY */}
        <div className="text-center space-y-2 mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/60 border border-amber-200/50 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest text-amber-900/80 mb-1"
          >
            <Sparkles size={10} className="text-amber-700 animate-pulse" />
            <span>Behavioral Intelligence OS</span>
          </motion.div>
          
          <h1 className="text-5xl font-cursive italic text-[#1A1A1A] font-semibold tracking-tight">
            DIYA
          </h1>
          <p className="text-[11px] font-mono tracking-[0.25em] uppercase opacity-55 font-semibold">
            Daily Intelligent Yield Assistant
          </p>
        </div>

        {/* ERROR MESSAGE DISPLAY */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3.5 bg-red-50/80 border border-red-200 rounded-xl text-xs text-red-800 flex gap-2"
            >
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FIREBASE LOCAL WARNING INDICATOR */}
        {isOfflineMode && (
          <div className="mb-5 p-3 bg-[#FEFCE8] border border-yellow-200/60 rounded-xl text-[11px] text-amber-900/80 font-mono flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-amber-700" />
            <div>
              <span className="font-bold uppercase block mb-0.5">Offline Local Mode Active</span>
              <span>Running with secure localStorage fallback sync. Credentials can be entered freely to sign in.</span>
            </div>
          </div>
        )}

        {/* INPUT FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                key="username-field"
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-1.5"
              >
                <label className="text-xs font-mono font-bold opacity-60 block uppercase tracking-wider pl-1">
                  Full Name / Alias
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    required={!isLogin}
                    placeholder="Eleanor"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm skeu-input text-[#2D2D2D]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold opacity-60 block uppercase tracking-wider pl-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35">
                <Mail size={15} />
              </span>
              <input
                type="email"
                required
                placeholder="eleanor@diya.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm skeu-input text-[#2D2D2D]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold opacity-60 block uppercase tracking-wider pl-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35">
                <Lock size={15} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 text-sm skeu-input text-[#2D2D2D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/35 hover:text-black/60 rounded"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                key="confirm-password-field"
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-1.5"
              >
                <label className="text-xs font-mono font-bold opacity-60 block uppercase tracking-wider pl-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35">
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!isLogin}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm skeu-input text-[#2D2D2D]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full skeu-btn py-3 mt-6 text-sm font-bold bg-[#1A1A1A] text-[#F9F7F2] hover:bg-black/95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span style={{ fontFamily: "Cormorant Garamond", fontSize: "15px", color: "#F9F7F2", fontStyle: "italic" }}>
                  {isLogin ? "Authenticate Session" : "Compile DIYA Credentials"}
                </span>
                <ArrowRight size={15} style={{ fontSize: "15px", color: "#F9F7F2" }} />
              </>
            )}
          </button>
        </form>

        {/* TRANSITION FOOTER TOGGLE */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-xs text-[#2D2D2D] opacity-65">
            {isLogin ? "New user of DIYA Life OS?" : "Registered on another node?"}{" "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="font-bold underline text-black cursor-pointer hover:opacity-80"
            >
              {isLogin ? "Create Local Account" : "Access Registered Node"}
            </button>
          </p>

          <div className="flex items-center gap-2 my-2 justify-center">
            <div className="h-[1px] bg-black/10 flex-1" />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Or</span>
            <div className="h-[1px] bg-black/10 flex-1" />
          </div>

          <button
            onClick={handleGuestBypass}
            disabled={isLoading}
            className="text-xs font-semibold uppercase tracking-wider text-black/60 hover:text-black hover:underline cursor-pointer"
          >
            Bypass to Sandbox (Eleanor)
          </button>
        </div>

        {/* BOTTOM PHILOSOPHICAL QUOTE */}
        <div className="mt-10 pt-4 border-t border-black/5 text-center">
          <span className="text-[11px] cursive-title opacity-45 italic block">
            "Design for a life well lived."
          </span>
        </div>
      </motion.div>
    </div>
  );
}
