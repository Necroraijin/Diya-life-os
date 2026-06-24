"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface WelcomeAnimationProps {
  onComplete: () => void;
}

export default function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 800);
    const timer2 = setTimeout(() => setStage(2), 2200);
    const timer3 = setTimeout(() => setStage(3), 3600);
    const timer4 = setTimeout(() => onComplete(), 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-[#F9F7F2] flex flex-col items-center justify-center z-50 p-6">
      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div
            key="stage0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-black/40">
              INITIATING SYSTEMS
            </span>
          </motion.div>
        )}

        {stage === 1 && (
          <motion.div
            key="stage1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-4"
          >
            <h1 className="text-6xl font-cursive italic text-[#1A1A1A] font-semibold">
              DIYA
            </h1>
            <p className="text-sm font-mono tracking-widest uppercase opacity-60">
              Daily Intelligent Yield Assistant
            </p>
          </motion.div>
        )}

        {stage === 2 && (
          <motion.div
            key="stage2"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-3"
          >
            <div className="h-[2px] w-24 bg-black/10 mx-auto" />
            <p className="text-2xl font-cursive italic text-[#2D2D2D]">
              "Design for a life well lived."
            </p>
            <span className="text-xs font-mono tracking-widest text-[#2D2D2D] opacity-40 uppercase">
              Behavioral Intelligence Active
            </span>
          </motion.div>
        )}

        {stage === 3 && (
          <motion.div
            key="stage3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <span className="text-xs font-mono tracking-widest uppercase opacity-50">
              Calibrating Cognitive Load...
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
