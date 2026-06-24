"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, Check, Trash2, Mic, MicOff, Volume2, VolumeX, Sparkles, 
  Calendar, Brain, AlertTriangle, Cpu, Compass, FolderClosed, Layers,
  LogOut, Clock, CalendarDays, BarChart4, ChevronRight, ChevronLeft, CheckCircle2,
  Sliders, Menu, X, Pencil, ArrowRight, User, Settings,
  Wallet, Send, Globe, RefreshCw, ShieldCheck, DollarSign, Link2, Info
} from "lucide-react";
import { firestoreDb } from "@/lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  deleteDoc, doc, updateDoc, writeBatch, serverTimestamp 
} from "firebase/firestore";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "normal";
  friction: number; // 1 to 5 dots
  completed: boolean;
  consequence?: string;
  category?: string;
  date?: string; // YYYY-MM-DD
  actionUrl?: string;
  actionType?: "pay_bill" | "email_draft" | "prefilled_form" | "general" | "link";
  amount?: number;
  payee?: string;
  content?: string;
}

interface ScheduleBlock {
  id: string;
  time: string; // e.g. "09:30 AM"
  title: string;
  description: string;
  type: "focus" | "meeting" | "buffer" | "routine";
  duration: string; // e.g., "30m", "60m"
  friction: number; // 1 to 5
  date?: string; // YYYY-MM-DD
}

interface DashboardProps {
  user: {
    email: string | null;
    displayName: string | null;
    uid: string;
  };
  onLogOut: () => void;
}

export default function Dashboard({ user, onLogOut }: DashboardProps) {
  // Navigation & UI Layout states
  const [activeTab, setActiveTab] = useState<"directives" | "schedule" | "settings">("schedule");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState(user.displayName || "Eleanor");
  const [userName, setUserName] = useState(user.displayName || "Eleanor");
  
  // Calendar Navigation States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Task Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "normal">("normal");
  const [newFriction, setNewFriction] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newActionType, setNewActionType] = useState<"pay_bill" | "email_draft" | "prefilled_form" | "general" | "link">("general");
  const [newActionUrl, setNewActionUrl] = useState("");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newPayee, setNewPayee] = useState("");
  const [newDraftContent, setNewDraftContent] = useState("");

  // Connections Sync States
  const [connections, setConnections] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`diya_connections_${user.uid}`);
      return saved ? JSON.parse(saved) : { googleCalendar: false, gmail: false, googleTasks: false, outlook: false };
    }
    return { googleCalendar: false, gmail: false, googleTasks: false, outlook: false };
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState("");

  // DIYA Secure Action Portal States
  const [activeActionTask, setActiveActionTask] = useState<Task | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("DIYA Secure Wallet");

  // Schedule Block Create Form State
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedTime, setSchedTime] = useState("09:00 AM");
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDesc, setSchedDesc] = useState("");
  const [schedType, setSchedType] = useState<"focus" | "meeting" | "buffer" | "routine">("focus");
  const [schedDuration, setSchedDuration] = useState("60m");
  const [schedFriction, setSchedFriction] = useState(3);

  // Editing Block State (For modifying scheduled blocks)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editSchedTime, setEditSchedTime] = useState("");
  const [editSchedTitle, setEditSchedTitle] = useState("");
  const [editSchedDesc, setEditSchedDesc] = useState("");
  const [editSchedType, setEditSchedType] = useState<"focus" | "meeting" | "buffer" | "routine">("focus");
  const [editSchedDuration, setEditSchedDuration] = useState("60m");
  const [editSchedFriction, setEditSchedFriction] = useState(3);

  // Voice Speech API States
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);

  // Cognitive Index Indicators
  const [cognitiveLoadMorning, setCognitiveLoadMorning] = useState(35);
  const [cognitiveLoadAfternoon, setCognitiveLoadAfternoon] = useState(65);

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Local storage save operations
  const saveLocalTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
    if (typeof window !== "undefined") {
      localStorage.setItem(`diya_tasks_${user.uid}`, JSON.stringify(newTasks));
    }
  }, [user.uid]);

  const saveLocalSchedules = useCallback((newSchedules: ScheduleBlock[]) => {
    setScheduleBlocks(newSchedules);
    if (typeof window !== "undefined") {
      localStorage.setItem(`diya_schedules_${user.uid}`, JSON.stringify(newSchedules));
    }
  }, [user.uid]);

  // Seeding initial high-quality timeline and directives
  const seedInitialTasks = useCallback(async (localOnly = false) => {
    const today = getTodayString();
    const seeds: Omit<Task, "id" | "completed">[] = [
      {
        title: "Submit WiFi & Fiber optic bill payment",
        description: "Fetch bill from your inbox and authorization portal. Avoid penalty.",
        priority: "high",
        friction: 1,
        consequence: "Delaying this triggers a $15 late fee and account throttling.",
        category: "Bills",
        date: today,
        actionType: "pay_bill",
        amount: 54.95,
        payee: "Astound Wave Fiber",
        actionUrl: "https://astound.com/pay-bill"
      },
      {
        title: "Draft Reply: Q4 Budget Proposal",
        description: "Align response to Director Miller using your priority bullet points.",
        priority: "medium",
        friction: 3,
        consequence: "Pushes review to overnight, causing schedule lag tomorrow.",
        category: "Communication",
        date: today,
        actionType: "email_draft",
        payee: "Director Miller",
        content: "Hi Director Miller,\n\nI have reviewed the Q4 Budget Proposals. I recommend moving 15% of the general buffer allocation to our active DIYA Node deployment. This aligns perfectly with our timeline optimization targets.\n\nBest,\nEleanor"
      },
      {
        title: "Weekly Grocery Restock",
        description: "Cart updated with your custom grocery selections and healthy routine items.",
        priority: "normal",
        friction: 1,
        consequence: "Ordering later limits delivery slots, shifting pickup times.",
        category: "Personal",
        date: today,
        actionType: "link",
        actionUrl: "https://instacart.com"
      }
    ];

    const seededList: Task[] = seeds.map((s, index) => ({
      id: `seed-task-${index}`,
      completed: false,
      ...s
    }));

    if (localOnly || !firestoreDb) {
      saveLocalTasks(seededList);
    } else {
      try {
        const batch = writeBatch(firestoreDb);
        seeds.forEach((seed) => {
          const docRef = doc(collection(firestoreDb, `tasks_${user.uid}`));
          batch.set(docRef, {
            ...seed,
            completed: false,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      } catch (e) {
        console.warn("Firestore seed failed, writing local storage:", e);
        saveLocalTasks(seededList);
      }
    }
  }, [saveLocalTasks, user.uid]);

  const seedInitialSchedules = useCallback(async (localOnly = false) => {
    const today = getTodayString();
    const seeds: Omit<ScheduleBlock, "id">[] = [
      {
        time: "09:30 AM",
        title: "Daily Standup & Tech Sync",
        description: "Review milestones with core developers and unblock pipelines.",
        type: "meeting",
        duration: "30m",
        friction: 2,
        date: today
      },
      {
        time: "11:00 AM",
        title: "Deep Work: Core Scheduling Algorithms",
        description: "Focus blocks to optimize DIYA's neural timeline logic.",
        type: "focus",
        duration: "90m",
        friction: 4,
        date: today
      },
      {
        time: "01:30 PM",
        title: "Administrative Triage",
        description: "Slack checking, inbox clearing, and document validations.",
        type: "buffer",
        duration: "45m",
        friction: 1,
        date: today
      },
      {
        time: "03:30 PM",
        title: "Q4 Budget Planning Call",
        description: "Direct connection with Director Miller to review hardware allocation.",
        type: "meeting",
        duration: "60m",
        friction: 3,
        date: today
      },
      {
        time: "05:00 PM",
        title: "Routine Decompression & Offload",
        description: "Archive active goals and plan tomorrow's morning schedule.",
        type: "routine",
        duration: "30m",
        friction: 1,
        date: today
      }
    ];

    const seededList: ScheduleBlock[] = seeds.map((s, index) => ({
      id: `seed-sched-${index}`,
      ...s
    }));

    if (localOnly || !firestoreDb) {
      saveLocalSchedules(seededList);
    } else {
      try {
        const batch = writeBatch(firestoreDb);
        seeds.forEach((seed) => {
          const docRef = doc(collection(firestoreDb, `schedules_${user.uid}`));
          batch.set(docRef, {
            ...seed,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      } catch (e) {
        console.warn("Firestore seed schedules failed, writing local fallback:", e);
        saveLocalSchedules(seededList);
      }
    }
  }, [saveLocalSchedules, user.uid]);

  const loadLocalData = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const storedTasks = localStorage.getItem(`diya_tasks_${user.uid}`);
    if (storedTasks) {
      setTasks(JSON.parse(storedTasks));
    } else {
      seedInitialTasks(true);
    }

    const storedSchedules = localStorage.getItem(`diya_schedules_${user.uid}`);
    if (storedSchedules) {
      setScheduleBlocks(JSON.parse(storedSchedules));
    } else {
      seedInitialSchedules(true);
    }
  }, [seedInitialTasks, seedInitialSchedules, user.uid]);

  // Handle bootstrap
  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // Listen to Firestore Tasks
  useEffect(() => {
    if (!firestoreDb) return;
    try {
      const q = query(collection(firestoreDb, `tasks_${user.uid}`), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Task[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Task);
        });
        if (list.length > 0) {
          setTasks(list);
        } else {
          seedInitialTasks();
        }
      }, (error) => {
        console.warn("Firestore access error, fallback to local:", error);
        loadLocalData();
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore subscription failed, local fallback:", e);
      loadLocalData();
    }
  }, [seedInitialTasks, loadLocalData, user.uid]);

  // Listen to Firestore Schedule Blocks
  useEffect(() => {
    if (!firestoreDb) return;
    try {
      const q = query(collection(firestoreDb, `schedules_${user.uid}`), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: ScheduleBlock[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ScheduleBlock);
        });
        if (list.length > 0) {
          setScheduleBlocks(list);
        } else {
          seedInitialSchedules();
        }
      }, (error) => {
        console.warn("Firestore schedules error, fallback:", error);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore schedules failed:", e);
    }
  }, [seedInitialSchedules, user.uid]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setVoiceTranscript(transcript);
          handleVoiceCommand(transcript);
        };
        setRecognition(rec);
      }
    }
  }, [tasks, scheduleBlocks]);

  const speakFeedback = (text: string) => {
    if (!voiceOutputEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceCommand = async (command: string) => {
    const cmd = command.toLowerCase();
    
    if (cmd.includes("hello") || cmd.includes("hi diya")) {
      speakFeedback(`Hello ${userName}. Cognitive networks synced. Shall we manage your calendar?`);
      return;
    }

    if (cmd.includes("schedule") || cmd.includes("calendar")) {
      let parsedTime = "10:00 AM";
      let blockTitle = command.replace(/(schedule|calendar)/gi, "").trim();
      
      const timeRegex = /(\d{1,2})\s*([ap]m)/i;
      const match = blockTitle.match(timeRegex);
      if (match) {
        parsedTime = `${match[1]}:00 ${match[2].toUpperCase()}`;
        blockTitle = blockTitle.replace(timeRegex, "").replace(/\bat\b/gi, "").trim();
      }

      if (blockTitle) {
        await handleAddScheduleDirectly(parsedTime, blockTitle, "Voice added schedule block.", "focus", "60m", 3, selectedDate);
        speakFeedback(`Scheduled ${blockTitle} at ${parsedTime} on current date.`);
      } else {
        speakFeedback("Scheduling detected, but title could not be parsed. Try: schedule sync at 11 AM.");
      }
      return;
    }

    if (cmd.includes("add task") || cmd.includes("create task")) {
      const taskTitle = command.replace(/(add task|create task)/gi, "").trim();
      if (taskTitle) {
        let priority: "high" | "medium" | "normal" = "normal";
        let friction = 2;
        let consequence = "No urgent consequence identified. Stable flow predicted.";
        
        if (cmd.includes("urgent") || cmd.includes("high") || cmd.includes("important")) {
          priority = "high";
          friction = 4;
          consequence = "High risk of bottleneck if not resolved today.";
        }

        await handleAddTaskDirectly(taskTitle, "Voice added task via DIYA microphone capture.", priority, friction, consequence, selectedDate);
        speakFeedback(`Added directive: ${taskTitle}.`);
      } else {
        speakFeedback("Could not resolve directive title. Say: add task review documentation.");
      }
      return;
    }

    if (cmd.includes("complete") || cmd.includes("check off")) {
      const target = cmd.replace(/(complete|check off)/gi, "").trim();
      const matched = tasks.find(t => t.title.toLowerCase().includes(target));
      if (matched) {
        await toggleTask(matched.id, matched.completed);
        speakFeedback(`Resolved task: ${matched.title}.`);
      } else {
        speakFeedback("No matching active task found.");
      }
      return;
    }

    speakFeedback("Statement analyzed, no direct actions matched. Try stating: schedule team standup at 3 PM.");
  };

  const toggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      setVoiceTranscript("");
      recognition.start();
    }
  };

  // Direct operations for adding, editing and deleting
  const handleAddTaskDirectly = async (
    title: string, 
    desc: string, 
    priority: "high" | "medium" | "normal", 
    friction: number,
    customConsequence?: string,
    targetDate?: string,
    actionType?: "pay_bill" | "email_draft" | "prefilled_form" | "general" | "link",
    actionUrl?: string,
    amount?: number,
    payee?: string,
    content?: string
  ) => {
    const consequence = customConsequence || (
      priority === "high" 
        ? "Delaying this will cause significant cognitive blockage and push schedules back by 1.5 hours."
        : priority === "medium"
          ? "Medium risk. Postponing creates minor administrative backlog."
          : "Safe task. Safe to complete during low flow hours."
    );

    const newTask: Omit<Task, "id"> = {
      title,
      description: desc || "Manually logged task.",
      priority,
      friction,
      completed: false,
      consequence,
      category: priority === "high" ? "Critical" : priority === "medium" ? "Active" : "Routine",
      date: targetDate || selectedDate,
      actionType: actionType || "general",
      actionUrl: actionUrl || "",
      amount: amount || undefined,
      payee: payee || "",
      content: content || ""
    };

    if (firestoreDb) {
      try {
        await addDoc(collection(firestoreDb, `tasks_${user.uid}`), {
          ...newTask,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Firestore error saving task, fallback:", e);
        const list = [...tasks, { id: `task-${Date.now()}`, ...newTask }];
        saveLocalTasks(list);
      }
    } else {
      const list = [...tasks, { id: `task-${Date.now()}`, ...newTask }];
      saveLocalTasks(list);
    }
    setCognitiveLoadAfternoon(prev => Math.min(100, prev + 5));
  };

  const handleAddScheduleDirectly = async (
    time: string,
    title: string,
    description: string,
    type: "focus" | "meeting" | "buffer" | "routine",
    duration: string,
    friction: number,
    targetDate?: string
  ) => {
    const newBlock: Omit<ScheduleBlock, "id"> = {
      time,
      title,
      description,
      type,
      duration,
      friction,
      date: targetDate || selectedDate
    };

    if (firestoreDb) {
      try {
        await addDoc(collection(firestoreDb, `schedules_${user.uid}`), {
          ...newBlock,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Firestore error schedule block, fallback:", e);
        const list = [...scheduleBlocks, { id: `sched-${Date.now()}`, ...newBlock }];
        saveLocalSchedules(list);
      }
    } else {
      const list = [...scheduleBlocks, { id: `sched-${Date.now()}`, ...newBlock }];
      saveLocalSchedules(list);
    }
    setCognitiveLoadAfternoon(prev => Math.min(100, prev + friction * 3));
  };

  const toggleTask = async (id: string, currentCompleted: boolean) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !currentCompleted } : t);
    saveLocalTasks(updatedTasks);

    if (firestoreDb && !id.startsWith("seed-") && !id.startsWith("task-")) {
      try {
        await updateDoc(doc(firestoreDb, `tasks_${user.uid}`, id), {
          completed: !currentCompleted
        });
      } catch (e) {
        console.warn("Failed updating Firestore task:", e);
      }
    }

    if (!currentCompleted) {
      const completedTask = tasks.find(t => t.id === id);
      if (completedTask) {
        speakFeedback(`Excellent. Resolved backlog: ${completedTask.title}.`);
      }
      setCognitiveLoadAfternoon(prev => Math.max(10, prev - 6));
    }
  };

  const editTask = async (id: string, updatedFields: Partial<Task>) => {
    const updated = tasks.map(t => t.id === id ? { ...t, ...updatedFields } : t);
    saveLocalTasks(updated);

    if (firestoreDb && !id.startsWith("seed-") && !id.startsWith("task-")) {
      try {
        await updateDoc(doc(firestoreDb, `tasks_${user.uid}`, id), updatedFields);
      } catch (e) {
        console.warn("Failed updating Firestore task:", e);
      }
    }
    speakFeedback("Task modifications saved.");
  };

  const editScheduleBlock = async (id: string, updatedFields: Partial<ScheduleBlock>) => {
    const updated = scheduleBlocks.map(b => b.id === id ? { ...b, ...updatedFields } : b);
    saveLocalSchedules(updated);

    if (firestoreDb && !id.startsWith("seed-") && !id.startsWith("sched-")) {
      try {
        await updateDoc(doc(firestoreDb, `schedules_${user.uid}`, id), updatedFields);
      } catch (e) {
        console.warn("Failed updating Firestore block:", e);
      }
    }
    speakFeedback("Schedule block updated.");
  };

  const deleteTask = async (id: string) => {
    const updatedTasks = tasks.filter(t => t.id !== id);
    saveLocalTasks(updatedTasks);

    if (firestoreDb && !id.startsWith("seed-") && !id.startsWith("task-")) {
      try {
        await deleteDoc(doc(firestoreDb, `tasks_${user.uid}`, id));
      } catch (e) {
        console.warn("Failed deleting Firestore task:", e);
      }
    }
  };

  const deleteScheduleBlock = async (id: string) => {
    const updated = scheduleBlocks.filter(b => b.id !== id);
    saveLocalSchedules(updated);

    if (firestoreDb && !id.startsWith("seed-") && !id.startsWith("sched-")) {
      try {
        await deleteDoc(doc(firestoreDb, `schedules_${user.uid}`, id));
      } catch (e) {
        console.warn("Failed deleting Firestore block:", e);
      }
    }
  };

  const toggleConnectionNode = (node: "googleCalendar" | "gmail" | "googleTasks" | "outlook") => {
    const updated = { ...connections, [node]: !connections[node] };
    setConnections(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`diya_connections_${user.uid}`, JSON.stringify(updated));
    }
    const nodeLabel = node === "googleCalendar" ? "Google Calendar" : node === "gmail" ? "Gmail Inbox" : node === "googleTasks" ? "Google Tasks" : "Outlook Sync";
    speakFeedback(`${nodeLabel} ${updated[node] ? "synchronized node active" : "deactivated"}`);
  };

  const triggerAccountSync = async () => {
    const activeConnects = Object.entries(connections).filter(([_, val]) => val).map(([key]) => key);
    if (activeConnects.length === 0) {
      speakFeedback("Select at least one connection node in Settings or Dashboard to synchronize workspace streams.");
      setSyncStatusText("Select active connection nodes first.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(10);
    setSyncStatusText("Resolving workspace API tokens...");
    speakFeedback("Synchronizing selected life nodes with DIYA.");

    const steps = [
      { p: 35, text: "Scanning secure Gmail inbox feeds for bill alerts..." },
      { p: 65, text: "Compiling Google Calendar schedule blocks..." },
      { p: 85, text: "Syncing Google Tasks active backlog lists..." },
      { p: 100, text: "Modelling cognitive load buffers and finalizing OS feed..." }
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setSyncProgress(steps[i].p);
      setSyncStatusText(steps[i].text);
    }

    const today = getTodayString();
    const alreadySynced = tasks.some(t => t.title.toLowerCase().includes("utility bill") || t.title.toLowerCase().includes("sarah jenkins"));

    if (alreadySynced) {
      setIsSyncing(false);
      setSyncStatusText("Synchronization up-to-date.");
      speakFeedback("DIYA synchronization check complete. All nodes are up to date.");
      return;
    }

    if (connections.gmail) {
      await handleAddTaskDirectly(
        "Pay Pacific Gas & Electric utility bill",
        "Auto-extracted statement balance due from Gmail alert (noreply@pge.com).",
        "high",
        2,
        "Postponing will incur an 8% late interest charge and automatic status warning flag.",
        today,
        "pay_bill",
        "https://www.pge.com/quickpay",
        85.40,
        "PG&E (Pacific Gas & Electric)"
      );

      await handleAddTaskDirectly(
        "Draft Response: Q3 Marketing Assets Request",
        "Auto-drafted response regarding sarah.jenkins@company.com feedback.",
        "medium",
        3,
        "Delays Sarah's design sprint timeline block, affecting tomorrow's standup.",
        today,
        "email_draft",
        "",
        undefined,
        "Sarah Jenkins",
        "Hi Sarah,\n\nI reviewed the Q3 marketing templates. They look excellent. I suggest we shift the launch graphics by 2 days to coordinate with our press releases.\n\nThanks,\nEleanor"
      );
    }

    if (connections.googleCalendar) {
      await handleAddScheduleDirectly(
        "11:00 AM",
        "Workspace OAuth Technical Sync",
        "Schedules synced from Google Calendar. Reviewing credential scopes.",
        "meeting",
        "45m",
        2,
        today
      );
      await handleAddScheduleDirectly(
        "02:30 PM",
        "DIYA System Maintenance Panel",
        "Imported from Calendar invites. Check integration health and rules.",
        "routine",
        "30m",
        1,
        today
      );
    }

    if (connections.googleTasks) {
      await handleAddTaskDirectly(
        "Complete performance matrix specs",
        "Directly imported from Google Tasks (My Tasks).",
        "normal",
        3,
        "High friction item. Delays sprint kickoff scheduling blocks.",
        today,
        "general"
      );
    }

    setIsSyncing(false);
    setSyncStatusText("Sync succeeded! System up-to-date.");
    speakFeedback("DIYA synchronization complete. New scheduling blocks and active billing actions compiled.");
  };

  // Form Handlers
  const handleCreateTaskForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    await handleAddTaskDirectly(
      newTitle, 
      newDesc, 
      newPriority, 
      newFriction, 
      undefined, 
      selectedDate,
      newActionType,
      newActionUrl,
      newAmount ? parseFloat(newAmount) : undefined,
      newPayee,
      newDraftContent
    );
    
    setNewTitle("");
    setNewDesc("");
    setNewPriority("normal");
    setNewFriction(2);
    setNewActionType("general");
    setNewActionUrl("");
    setNewAmount("");
    setNewPayee("");
    setNewDraftContent("");
    setShowAddForm(false);
    setIsSubmitting(false);

    speakFeedback("New directive successfully parsed.");
  };

  const handleCreateScheduleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim()) return;

    await handleAddScheduleDirectly(schedTime, schedTitle, schedDesc, schedType, schedDuration, schedFriction, selectedDate);
    
    setSchedTitle("");
    setSchedDesc("");
    setSchedTime("09:00 AM");
    setSchedType("focus");
    setSchedDuration("60m");
    setSchedFriction(3);
    setShowScheduleForm(false);

    speakFeedback("Chronos schedule block integrated.");
  };

  const handleEditScheduleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlockId || !editSchedTitle.trim()) return;

    await editScheduleBlock(editingBlockId, {
      time: editSchedTime,
      title: editSchedTitle,
      description: editSchedDesc,
      type: editSchedType,
      duration: editSchedDuration,
      friction: editSchedFriction
    });

    setEditingBlockId(null);
  };

  const handleStartEditBlock = (block: ScheduleBlock) => {
    setEditingBlockId(block.id);
    setEditSchedTime(block.time);
    setEditSchedTitle(block.title);
    setEditSchedDesc(block.description);
    setEditSchedType(block.type);
    setEditSchedDuration(block.duration);
    setEditSchedFriction(block.friction);
  };

  const handleNameSave = () => {
    if (newNameInput.trim()) {
      setUserName(newNameInput);
      setIsEditingName(false);
      speakFeedback(`Greeting personalized to ${newNameInput}`);
    }
  };

  // Calendar Calculation Helpers
  const handleMonthChange = (direction: "prev" | "next") => {
    const d = new Date(currentMonth);
    if (direction === "prev") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentMonth(d);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous Month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevTotalDays - i;
      const prevMonthDate = new Date(year, month - 1, d);
      cells.push({
        day: d,
        dateString: `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: false
      });
    }

    // Current Month days
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: true
      });
    }

    // Next Month padding days to make perfect weeks (usually rows of 7)
    const remaining = 42 - cells.length; // 6 rows standard
    for (let d = 1; d <= remaining; d++) {
      const nextMonthDate = new Date(year, month + 1, d);
      cells.push({
        day: d,
        dateString: `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: false
      });
    }

    return cells;
  };

  const getBlockStyles = (type: "focus" | "meeting" | "buffer" | "routine") => {
    switch (type) {
      case "focus":
        return {
          border: "border-l-4 border-slate-700",
          bg: "bg-slate-50 hover:bg-slate-100/70",
          tagBg: "bg-slate-200 text-slate-800"
        };
      case "meeting":
        return {
          border: "border-l-4 border-amber-600",
          bg: "bg-amber-50/50 hover:bg-amber-50",
          tagBg: "bg-amber-100 text-amber-800"
        };
      case "buffer":
        return {
          border: "border-l-4 border-emerald-600",
          bg: "bg-emerald-50/50 hover:bg-emerald-50",
          tagBg: "bg-emerald-100 text-emerald-800"
        };
      case "routine":
        return {
          border: "border-l-4 border-sky-600",
          bg: "bg-sky-50/50 hover:bg-sky-50",
          tagBg: "bg-sky-100 text-sky-800"
        };
    }
  };

  // Filter schedules and tasks for active view/day
  const calendarDays = generateCalendarDays();
  const selectedDaySchedules = scheduleBlocks.filter(b => b.date === selectedDate || (!b.date && selectedDate === getTodayString()));
  const selectedDayTasks = tasks.filter(t => t.date === selectedDate || (!t.date && selectedDate === getTodayString()));
  
  // Upcoming tasks: uncompleted tasks, sorted with high priority first, then date-bound
  const upcomingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      return 0;
    });

  return (
    <div className="flex min-h-screen bg-[#F9F7F2] font-sans text-[#2D2D2D] relative overflow-hidden">
      
      {/* EXPANDABLE SIDEBAR - DESKTOP */}
      <aside 
        id="desktop-sidebar"
        className={`hidden md:flex flex-col justify-between bg-[#F4F1EA] border-r border-black/5 p-5 transition-all duration-300 z-30 shrink-0 ${
          isSidebarExpanded ? "w-64" : "w-20"
        }`}
      >
        <div className="space-y-8">
          {/* Logo Brand area */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-[#F9F7F2] font-bold text-lg shadow-sm">
                D
              </div>
              {isSidebarExpanded && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-cursive font-extrabold italic text-lg tracking-wide text-[#1A1A1A]"
                >
                  DIYA Life OS
                </motion.div>
              )}
            </div>
            
            {/* Toggle icon */}
            <button 
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="p-1.5 hover:bg-black/5 rounded-lg transition-colors text-black/60 cursor-pointer"
              title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <ChevronLeft size={16} className={`transition-transform duration-300 ${!isSidebarExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Nav links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("schedule")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "schedule"
                  ? "bg-black/5 text-[#1A1A1A]"
                  : "text-black/60 hover:text-[#1A1A1A] hover:bg-black/5"
              }`}
            >
              <CalendarDays size={18} className="shrink-0 text-black/75" />
              {isSidebarExpanded && <span>Chronos Calendar</span>}
            </button>

            <button
              onClick={() => setActiveTab("directives")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "directives"
                  ? "bg-black/5 text-[#1A1A1A]"
                  : "text-black/60 hover:text-[#1A1A1A] hover:bg-black/5"
              }`}
            >
              <Compass size={18} className="shrink-0 text-black/75" />
              {isSidebarExpanded && (
                <div className="flex items-center justify-between w-full">
                  <span>Focus Backlog</span>
                  <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded font-mono">
                    {tasks.filter(t => !t.completed).length}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "bg-black/5 text-[#1A1A1A]"
                  : "text-black/60 hover:text-[#1A1A1A] hover:bg-black/5"
              }`}
            >
              <Sliders size={18} className="shrink-0 text-black/75" />
              {isSidebarExpanded && <span>Node Settings</span>}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="pt-4 border-t border-black/5 space-y-4">
          {isSidebarExpanded ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 font-bold text-xs uppercase font-mono">
                  {userName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-[#1A1A1A]">{userName}</p>
                  <p className="text-[10px] opacity-50 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={onLogOut}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-red-700/80 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 font-bold text-xs uppercase font-mono">
                {userName.charAt(0)}
              </div>
              <button 
                onClick={onLogOut}
                className="p-2 text-red-700/80 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE HEADER BAR */}
      <div className="md:hidden w-full absolute top-0 left-0 bg-[#F4F1EA] border-b border-black/5 h-14 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#1A1A1A] flex items-center justify-center text-white font-bold text-sm">
            D
          </div>
          <span className="font-cursive italic font-bold">DIYA Life OS</span>
        </div>
        
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 hover:bg-black/5 rounded-lg text-black/75 cursor-pointer"
        >
          {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBILE DRAWER SIDEBAR */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black z-40"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-64 bg-[#F4F1EA] p-5 z-50 flex flex-col justify-between shadow-xl"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-black/5 pb-3">
                  <span className="font-cursive italic font-bold text-lg">DIYA Life OS</span>
                  <button 
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1 hover:bg-black/5 rounded text-black/60"
                  >
                    <X size={18} />
                  </button>
                </div>

                <nav className="space-y-1">
                  <button
                    onClick={() => { setActiveTab("schedule"); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === "schedule" ? "bg-black/5 text-[#1A1A1A]" : "text-black/60"
                    }`}
                  >
                    <CalendarDays size={18} />
                    <span>Chronos Calendar</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab("directives"); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === "directives" ? "bg-black/5 text-[#1A1A1A]" : "text-black/60"
                    }`}
                  >
                    <Compass size={18} />
                    <span>Focus Backlog</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab("settings"); setIsMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === "settings" ? "bg-black/5 text-[#1A1A1A]" : "text-black/60"
                    }`}
                  >
                    <Sliders size={18} />
                    <span>Settings</span>
                  </button>
                </nav>
              </div>

              <div className="space-y-4 pt-4 border-t border-black/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 font-bold text-xs uppercase font-mono">
                    {userName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{userName}</p>
                    <p className="text-[9px] opacity-50 truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { onLogOut(); setIsMobileSidebarOpen(false); }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-red-700/80 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN LAYOUT CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 p-4 md:p-8 space-y-6 overflow-y-auto max-h-screen pt-16 md:pt-8">
        
        {/* HEADER GREETINGS & VOICE PANEL */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-black/5 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNameInput}
                    onChange={(e) => setNewNameInput(e.target.value)}
                    className="text-2xl md:text-3xl font-cursive font-semibold italic text-[#1A1A1A] bg-transparent border-b border-[#2D2D2D] outline-none max-w-[200px]"
                    onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                    autoFocus
                  />
                  <button onClick={handleNameSave} className="text-xs bg-black/5 px-2 py-1 rounded hover:bg-black/10 transition-colors">Save</button>
                </div>
              ) : (
                <h1 
                  onClick={() => { setIsEditingName(true); setNewNameInput(userName); }}
                  className="text-2xl md:text-3xl font-cursive italic text-[#1A1A1A] font-semibold cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
                  title="Click to change display name"
                >
                  Welcome back, {userName}
                </h1>
              )}
            </div>
            
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-55">
              Sync Node Active — ID: <span className="text-amber-800 font-semibold font-mono">{user.email?.split("@")[0]}</span>
            </p>
          </div>

          {/* Quick Voice Settings */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/5 rounded-xl p-1 border border-black/5">
              <button 
                onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                className={`p-2 rounded-lg transition-colors ${voiceOutputEnabled ? "text-green-600 hover:bg-black/5" : "text-black/30 hover:bg-black/5"}`}
                title={voiceOutputEnabled ? "Voice feedback active" : "Muted"}
              >
                {voiceOutputEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              
              <button 
                onClick={toggleListening}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-[#F9F7F2] text-[#2D2D2D] border border-black/10 hover:bg-black/5"
                }`}
                title="DIYA Microphone Command System"
              >
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                <span>{isListening ? "Listening..." : "Speak command"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* VOICE TRANSCRIPT WATERMARK FEEDBACK */}
        <AnimatePresence>
          {voiceTranscript && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 shadow-sm"
            >
              <Sparkles size={14} className="text-amber-600 animate-spin" />
              <span><strong>Command Compiled:</strong> "{voiceTranscript}"</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DYNAMIC VIEWS SWITCHER */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: CHRONOS CALENDAR WITH MANAGE CAPABILITIES */}
          {activeTab === "schedule" && (
            <motion.div
              key="schedule-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* DIYA Workspace Sync Hub Banner */}
              <div className="skeu-card p-4 bg-gradient-to-r from-amber-50/70 via-[#F9F7F2] to-amber-50/30 border border-amber-200/40 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#D97706]">DIYA Node Synchronization Hub</span>
                    </div>
                    <h4 className="text-sm font-bold text-[#1A1A1A]">Consolidate Workspace Calendars & Inboxes</h4>
                    <p className="text-xs text-black/60 max-w-xl">
                      Tethers secure OAuth connections (Google Calendar, Gmail, Google Tasks, Outlook) and deploys AI scanners to parse utility bills, active alerts, and schedule blocks into DIYA.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Compact toggle icons */}
                    <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-xl border border-black/5">
                      <button 
                        onClick={() => toggleConnectionNode("googleCalendar")}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg transition-all ${
                          connections.googleCalendar 
                            ? "bg-[#1A1A1A] text-[#F9F7F2] shadow-sm" 
                            : "text-black/50 hover:bg-black/5"
                        }`}
                        title="Google Calendar Node"
                      >
                        Calendar
                      </button>
                      <button 
                        onClick={() => toggleConnectionNode("gmail")}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg transition-all ${
                          connections.gmail 
                            ? "bg-[#1A1A1A] text-[#F9F7F2] shadow-sm" 
                            : "text-black/50 hover:bg-black/5"
                        }`}
                        title="Gmail Feed Scan"
                      >
                        Gmail
                      </button>
                      <button 
                        onClick={() => toggleConnectionNode("googleTasks")}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg transition-all ${
                          connections.googleTasks 
                            ? "bg-[#1A1A1A] text-[#F9F7F2] shadow-sm" 
                            : "text-black/50 hover:bg-black/5"
                        }`}
                        title="Google Tasks API"
                      >
                        Tasks
                      </button>
                      <button 
                        onClick={() => toggleConnectionNode("outlook")}
                        className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg transition-all ${
                          connections.outlook 
                            ? "bg-[#1A1A1A] text-[#F9F7F2] shadow-sm" 
                            : "text-black/50 hover:bg-black/5"
                        }`}
                        title="Outlook Connection"
                      >
                        Outlook
                      </button>
                    </div>

                    <button
                      onClick={triggerAccountSync}
                      disabled={isSyncing}
                      className="skeu-btn px-4 py-2 text-xs font-bold flex items-center gap-2 bg-[#D97706] text-white border-[#B45309] hover:bg-[#C2410C] cursor-pointer disabled:opacity-55 shadow-md"
                    >
                      <RefreshCw size={17} style={{ color: "#000000", fontSize: "17px" }} className={isSyncing ? "animate-spin" : ""} />
                      <span style={{ color: "#000000", fontFamily: "Cormorant Garamond", fontWeight: "bold", fontStyle: "italic", fontSize: "15px" }}>{isSyncing ? "Syncing..." : "Sync Connections"}</span>
                    </button>
                  </div>
                </div>

                {/* Simulated live progress bar */}
                {isSyncing && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-amber-800 font-bold">{syncStatusText}</span>
                      <span className="opacity-50">{syncProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-300" 
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Split layout: Month Grid & Chosen Date Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* INTERACTIVE MONTHLY CALENDAR - lg:col-span-7 */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="skeu-card p-5 space-y-4">
                    
                    {/* Month Picker Header */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-bold tracking-tight text-[#1A1A1A]">
                          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </h2>
                        <p className="text-[10px] font-mono uppercase opacity-50 font-bold">Select a date to compile timeline blocks</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleMonthChange("prev")}
                          className="p-1.5 hover:bg-black/5 rounded-lg border border-black/5 transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setCurrentMonth(new Date())}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-black/5 hover:bg-black/5 rounded transition-all cursor-pointer"
                        >
                          Today
                        </button>
                        <button 
                          onClick={() => handleMonthChange("next")}
                          className="p-1.5 hover:bg-black/5 rounded-lg border border-black/5 transition-colors cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Weekday Names Header */}
                    <div className="grid grid-cols-7 gap-1 text-center font-mono font-bold text-[10px] uppercase tracking-wider opacity-60">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    {/* Calendar Day Cells Grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarDays.map((cell, idx) => {
                        const isSelected = selectedDate === cell.dateString;
                        const isToday = getTodayString() === cell.dateString;
                        
                        // Count schedules and tasks for this day to show dot markers
                        const daySchedules = scheduleBlocks.filter(b => b.date === cell.dateString);
                        const dayTasks = tasks.filter(t => t.date === cell.dateString);
                        const totalEvents = daySchedules.length + dayTasks.length;

                        return (
                          <button
                            key={`${cell.dateString}-${idx}`}
                            onClick={() => setSelectedDate(cell.dateString)}
                            className={`aspect-square p-1.5 rounded-xl flex flex-col justify-between text-left relative transition-all border cursor-pointer ${
                              isSelected
                                ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md transform scale-[1.03]"
                                : isToday
                                  ? "bg-amber-50 border-amber-300 text-[#1A1A1A]"
                                  : cell.isCurrentMonth
                                    ? "bg-[#F9F7F2] border-black/5 text-[#2D2D2D] hover:bg-black/5"
                                    : "bg-black/[0.02] border-transparent text-black/30 hover:bg-black/5"
                            }`}
                          >
                            <span className="text-xs font-bold font-mono">{cell.day}</span>
                            
                            {/* Dot Indicators */}
                            {totalEvents > 0 && (
                              <div className="flex gap-0.5 mt-auto flex-wrap max-w-full">
                                {daySchedules.slice(0, 3).map((b, bIdx) => (
                                  <div 
                                    key={`sched-dot-${b.id}`} 
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSelected 
                                        ? "bg-[#F9F7F2]" 
                                        : b.type === "focus" 
                                          ? "bg-slate-600" 
                                          : b.type === "meeting"
                                            ? "bg-amber-600"
                                            : b.type === "buffer"
                                              ? "bg-emerald-600"
                                              : "bg-sky-500"
                                    }`} 
                                    title={b.title}
                                  />
                                ))}
                                {dayTasks.slice(0, 2).map((t, tIdx) => (
                                  <div 
                                    key={`task-dot-${t.id}`} 
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSelected 
                                        ? "bg-amber-400" 
                                        : t.priority === "high" 
                                          ? "bg-red-500" 
                                          : "bg-blue-500"
                                    }`} 
                                    title={t.title}
                                  />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cognitive Capacity Status Box */}
                  <div className="skeu-card p-4 bg-gradient-to-br from-[#FEFCE8]/60 to-[#F9F7F2] border border-[#FEF08A]/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold opacity-50 font-mono tracking-wider">Cognitive Density Index</span>
                      <Cpu size={12} className="opacity-40" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold opacity-70">Focus Capacity Today</span>
                        <span className="text-emerald-700 font-mono font-bold">Safe (35% Load)</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-[35%]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TIMELINE SCHEDULER & EDIT FORMS FOR SELECTED DATE - lg:col-span-5 */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="skeu-card p-5 space-y-4">
                    
                    <div className="flex items-center justify-between border-b border-black/5 pb-2">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-[#1A1A1A]">
                          Timeline Blocks
                        </h3>
                        <p className="text-[10px] font-mono uppercase opacity-50 tracking-wider">
                          {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => { setShowScheduleForm(!showScheduleForm); setEditingBlockId(null); }}
                        className="skeu-btn px-3 py-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add Block</span>
                      </button>
                    </div>

                    {/* NEW CHRONOS BLOCK FORM */}
                    <AnimatePresence>
                      {showScheduleForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleCreateScheduleForm}
                          className="p-3 bg-black/[0.02] border border-dashed border-black/10 rounded-xl space-y-3 overflow-hidden text-xs"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Start Time</label>
                              <input
                                type="text"
                                required
                                placeholder="09:00 AM"
                                value={schedTime}
                                onChange={(e) => setSchedTime(e.target.value)}
                                className="w-full bg-[#F9F7F2] border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Duration</label>
                              <select
                                value={schedDuration}
                                onChange={(e) => setSchedDuration(e.target.value)}
                                className="w-full bg-[#F9F7F2] border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              >
                                <option value="15m">15m</option>
                                <option value="30m">30m</option>
                                <option value="45m">45m</option>
                                <option value="60m">1 Hour</option>
                                <option value="90m">1.5h</option>
                                <option value="120m">2 Hours</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Event Title</label>
                            <input
                              type="text"
                              required
                              placeholder="Strategy alignment..."
                              value={schedTitle}
                              onChange={(e) => setSchedTitle(e.target.value)}
                              className="w-full bg-[#F9F7F2] border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Event Details</label>
                            <input
                              type="text"
                              placeholder="Review milestones and unblock pipelines..."
                              value={schedDesc}
                              onChange={(e) => setSchedDesc(e.target.value)}
                              className="w-full bg-[#F9F7F2] border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Type</label>
                              <select
                                value={schedType}
                                onChange={(e) => setSchedType(e.target.value as any)}
                                className="w-full bg-[#F9F7F2] border border-black/10 rounded-md p-1 text-xs outline-none focus:border-black/30"
                              >
                                <option value="focus">Deep Focus</option>
                                <option value="meeting">Sync / Meeting</option>
                                <option value="buffer">Admin / Buffer</option>
                                <option value="routine">Routine Care</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-mono opacity-50 block mb-0.5 uppercase font-bold">Load Cost (1-5)</label>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={schedFriction}
                                onChange={(e) => setSchedFriction(Number(e.target.value))}
                                className="w-full accent-black mt-1"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1 border-t border-black/5">
                            <button
                              type="button"
                              onClick={() => setShowScheduleForm(false)}
                              className="px-2.5 py-1.5 text-[10px] font-semibold text-black/50 hover:text-black/85"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="skeu-btn px-3 py-1.5 text-[10px] font-bold bg-[#1A1A1A] text-[#4d4a4a]"
                            >
                              Commit Block
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* EDIT EXISTING CHRONOS BLOCK FORM */}
                    <AnimatePresence>
                      {editingBlockId && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleEditScheduleFormSubmit}
                          className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3 overflow-hidden text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                            <span className="font-mono font-bold uppercase text-[9px] text-amber-800">Edit Selected Block</span>
                            <button 
                              type="button" 
                              onClick={() => setEditingBlockId(null)}
                              className="p-0.5 hover:bg-black/5 rounded text-black/40"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Start Time</label>
                              <input
                                type="text"
                                required
                                value={editSchedTime}
                                onChange={(e) => setEditSchedTime(e.target.value)}
                                className="w-full bg-[#F9F7F2] border border-amber-300 rounded-md p-1.5 text-xs outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Duration</label>
                              <select
                                value={editSchedDuration}
                                onChange={(e) => setEditSchedDuration(e.target.value)}
                                className="w-full bg-[#F9F7F2] border border-amber-300 rounded-md p-1.5 text-xs outline-none"
                              >
                                <option value="15m">15m</option>
                                <option value="30m">30m</option>
                                <option value="45m">45m</option>
                                <option value="60m">1 Hour</option>
                                <option value="90m">1.5h</option>
                                <option value="120m">2 Hours</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Title</label>
                            <input
                              type="text"
                              required
                              value={editSchedTitle}
                              onChange={(e) => setEditSchedTitle(e.target.value)}
                              className="w-full bg-[#F9F7F2] border border-amber-300 rounded-md p-1.5 text-xs outline-none focus:border-amber-400"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Details</label>
                            <input
                              type="text"
                              value={editSchedDesc}
                              onChange={(e) => setEditSchedDesc(e.target.value)}
                              className="w-full bg-[#F9F7F2] border border-amber-300 rounded-md p-1.5 text-xs outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Type</label>
                              <select
                                value={editSchedType}
                                onChange={(e) => setEditSchedType(e.target.value as any)}
                                className="w-full bg-[#F9F7F2] border border-amber-300 rounded-md p-1 text-xs outline-none"
                              >
                                <option value="focus">Deep Focus</option>
                                <option value="meeting">Sync / Meeting</option>
                                <option value="buffer">Admin / Buffer</option>
                                <option value="routine">Routine Care</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-mono opacity-60 block mb-0.5 uppercase font-bold">Load Score</label>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={editSchedFriction}
                                onChange={(e) => setEditSchedFriction(Number(e.target.value))}
                                className="w-full accent-amber-600 mt-1"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-amber-200">
                            <button
                              type="button"
                              onClick={() => { deleteScheduleBlock(editingBlockId); setEditingBlockId(null); }}
                              className="text-red-700 font-bold hover:underline flex items-center gap-1 text-[10px]"
                            >
                              <Trash2 size={11} /> Delete Block
                            </button>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingBlockId(null)}
                                className="px-2.5 py-1.5 text-[10px] font-semibold text-black/50 hover:text-black"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="skeu-btn px-3 py-1.5 text-[10px] font-bold bg-[#1A1A1A] text-[#000000]"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* CHRONOS BLOCK DISPLAY TIMELINE */}
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      {selectedDaySchedules.length === 0 ? (
                        <div className="py-8 text-center bg-black/[0.01] border border-dashed border-black/10 rounded-xl space-y-2">
                          <p className="text-xs opacity-50 italic">No scheduled timeline blocks active on this date.</p>
                          <button 
                            type="button"
                            onClick={() => handleAddScheduleDirectly("09:00 AM", "New Scheduled Block", "Time-blocked allocation.", "focus", "60m", 2, selectedDate)}
                            className="text-[10px] underline font-bold tracking-wider uppercase cursor-pointer"
                          >
                            + Quick Allocation
                          </button>
                        </div>
                      ) : (
                        selectedDaySchedules.map((block) => {
                          const styles = getBlockStyles(block.type);
                          return (
                            <div 
                              key={block.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all relative cursor-pointer ${styles.bg} ${styles.border}`}
                              onClick={() => handleStartEditBlock(block)}
                              title="Click to edit block"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-center w-14 border-r border-black/5 pr-1.5 shrink-0">
                                  <p className="text-[10px] font-bold font-mono text-[#1A1A1A]">{block.time}</p>
                                  <p className="text-[8px] font-mono opacity-50">{block.duration}</p>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[#1A1A1A] truncate">{block.title}</h4>
                                  <p className="text-[10px] text-black/60 truncate">{block.description}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${styles.tagBg}`}>
                                  {block.type}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleStartEditBlock(block); }}
                                  className="p-1 hover:bg-black/5 rounded text-black/40 hover:text-black"
                                >
                                  <Pencil size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* REQUIREMENT 3: UPCOMING TASKS HE NEED TO PERFORM - DISPLAYED BELOW THE CALENDAR */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/5 pb-2">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
                      <Compass size={16} />
                      <span>Upcoming Tasks backlog</span>
                    </h3>
                    <p className="text-[10px] font-mono uppercase opacity-50 tracking-wider">High capacity directives sorted for proactive execution</p>
                  </div>
                  
                  <button 
                    onClick={() => { setActiveTab("directives"); setShowAddForm(true); }}
                    className="text-xs font-bold underline flex items-center gap-1 cursor-pointer"
                  >
                    Manage Backlog <ArrowRight size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingTasks.length === 0 ? (
                    <div className="col-span-full py-8 text-center bg-black/[0.01] border border-dashed border-black/10 rounded-xl">
                      <p className="text-xs opacity-50 italic">All pending tasks check-off! Timeline execution is clean.</p>
                    </div>
                  ) : (
                    upcomingTasks.slice(0, 6).map((task) => {
                      const isHigh = task.priority === "high";
                      const isMed = task.priority === "medium";
                      const borderAccent = isHigh 
                        ? "border-red-400 bg-red-50/[0.15]" 
                        : isMed 
                          ? "border-orange-400 bg-orange-50/[0.15]" 
                          : "border-blue-400 bg-blue-50/[0.15]";

                      return (
                        <div 
                          key={`upcoming-${task.id}`}
                          className={`skeu-card p-4 border-t-4 flex flex-col justify-between gap-3 ${borderAccent}`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleTask(task.id, task.completed)}
                                  className="w-4 h-4 rounded border flex items-center justify-center border-black/25 hover:border-black/60 shrink-0"
                                >
                                  {task.completed && <Check size={10} />}
                                </button>
                                <h4 className="text-xs font-bold text-[#1A1A1A] line-clamp-1">{task.title}</h4>
                              </div>
                              <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                                isHigh ? "bg-red-100 text-red-700" : isMed ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-[10px] text-black/60 line-clamp-2 pl-6">{task.description}</p>
                          </div>

                          <div className="pl-6 flex items-center justify-between border-t border-black/5 pt-2">
                            <button 
                              onClick={() => toggleTask(task.id, task.completed)}
                              className="text-[9px] font-bold uppercase tracking-wider hover:underline text-[#1A1A1A]"
                            >
                              Check Off
                            </button>
                            {task.date && (
                              <span className="text-[8px] font-mono opacity-50">Due: {task.date}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: BEHAVIORAL BACKLOG DIRECTIVES */}
          {activeTab === "directives" && (
            <motion.div
              key="directives-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-lg font-bold opacity-80 flex items-center gap-2 text-[#1A1A1A]">
                    <span>Focus Backlog Directives</span>
                  </h2>
                  <p className="text-xs opacity-50">Maintain high tactile response and clear consequence modeling constraints.</p>
                </div>
                
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="skeu-btn px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New Directive</span>
                </button>
              </div>

              {/* ADD DIRECTIVE FORM */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.form 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateTaskForm}
                    className="skeu-card p-5 space-y-4 overflow-hidden border border-dashed border-black/25"
                  >
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider opacity-60">Compile New Focus Directive</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-mono opacity-50 block mb-1">Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Confirm WiFi and optic fiber bill payment"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full bg-[#F9F7F2] border border-black/10 rounded-lg p-2.5 text-sm outline-none focus:border-black/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono opacity-50 block mb-1">Description</label>
                        <textarea
                          placeholder="DIYA will automatically model consequences and cognitive friction limits."
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          className="w-full bg-[#F9F7F2] border border-black/10 rounded-lg p-2.5 text-sm outline-none focus:border-black/30 h-16 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-mono opacity-50 block mb-1">Priority</label>
                          <select
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as any)}
                            className="w-full bg-[#F9F7F2] border border-black/10 rounded-lg p-2 text-sm outline-none focus:border-black/30"
                          >
                            <option value="normal">Normal</option>
                            <option value="medium">Medium</option>
                            <option value="high">High / Urgent</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-mono opacity-50 block mb-1">Friction Score</label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={newFriction}
                            onChange={(e) => setNewFriction(Number(e.target.value))}
                            className="w-full accent-[#2D2D2D] mt-3"
                          />
                        </div>
                      </div>

                      {/* Action Configuration */}
                      <div className="border-t border-black/5 pt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-[#D97706]" />
                          <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider font-mono">Automated DIYA Action Setup</h4>
                        </div>
                        
                        <div>
                          <label className="text-xs font-mono opacity-50 block mb-1">Action Flow Type</label>
                          <select
                            value={newActionType}
                            onChange={(e) => setNewActionType(e.target.value as any)}
                            className="w-full bg-[#F9F7F2] border border-black/10 rounded-lg p-2 text-sm outline-none focus:border-black/30"
                          >
                            <option value="general">No Action (General Task)</option>
                            <option value="pay_bill">Pay Bill (Skeuomorphic Payment Portal)</option>
                            <option value="email_draft">Email Draft (Smart Response Template)</option>
                            <option value="link">Custom URL / External Portal Link</option>
                          </select>
                        </div>

                        {newActionType === "pay_bill" && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                            <div>
                              <label className="text-[10px] font-mono opacity-60 block mb-1">Payee Name</label>
                              <input
                                type="text"
                                placeholder="e.g. PG&E"
                                value={newPayee}
                                onChange={(e) => setNewPayee(e.target.value)}
                                className="w-full bg-white border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono opacity-60 block mb-1">Amount ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 85.40"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                className="w-full bg-white border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono opacity-60 block mb-1">Payment Link</label>
                              <input
                                type="text"
                                placeholder="e.g. https://pge.com/pay"
                                value={newActionUrl}
                                onChange={(e) => setNewActionUrl(e.target.value)}
                                className="w-full bg-white border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              />
                            </div>
                          </div>
                        )}

                        {newActionType === "email_draft" && (
                          <div className="space-y-3 p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                            <div>
                              <label className="text-[10px] font-mono opacity-60 block mb-1">Recipient Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Director Miller"
                                value={newPayee}
                                onChange={(e) => setNewPayee(e.target.value)}
                                className="w-full bg-white border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono opacity-60 block mb-1">AI Draft Email Body</label>
                              <textarea
                                placeholder="Write the email content you want DIYA to help you send."
                                value={newDraftContent}
                                onChange={(e) => setNewDraftContent(e.target.value)}
                                className="w-full bg-white border border-black/10 rounded-md p-2 text-xs outline-none focus:border-black/30 h-20 resize-none"
                              />
                            </div>
                          </div>
                        )}

                        {newActionType === "link" && (
                          <div className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                            <label className="text-[10px] font-mono opacity-60 block mb-1">Custom Portal URL Link</label>
                            <input
                              type="text"
                              placeholder="e.g. https://myportal.com"
                              value={newActionUrl}
                              onChange={(e) => setNewActionUrl(e.target.value)}
                              className="w-full bg-white border border-black/10 rounded-md p-1.5 text-xs outline-none focus:border-black/30"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 text-xs font-semibold text-black/50 hover:text-black/80"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="skeu-btn px-4 py-2 text-xs font-bold bg-[#1A1A1A] text-white"
                      >
                        {isSubmitting ? "Integrating..." : "Compile"}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* DIRECTIVES LIST */}
              <div className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-black/5 rounded-2xl border border-dashed border-black/10">
                    <p className="text-sm opacity-60">No active behavioral directives compiled.</p>
                    <button 
                      onClick={() => seedInitialTasks()} 
                      className="mt-3 text-xs underline font-semibold cursor-pointer"
                    >
                      Load Intelligence Seeds
                    </button>
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isHigh = task.priority === "high";
                    const isMed = task.priority === "medium";
                    const borderAccent = isHigh ? "bg-red-400" : isMed ? "bg-orange-400" : "bg-blue-400";
                    
                    return (
                      <div 
                        key={task.id}
                        className={`skeu-card p-5 flex items-start space-x-5 relative transition-opacity duration-300 ${
                          task.completed ? "opacity-50" : "opacity-100 hover:shadow-md"
                        }`}
                      >
                        <div className={`w-1 ${borderAccent} h-14 rounded-full self-center flex-shrink-0`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => toggleTask(task.id, task.completed)}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                  task.completed 
                                    ? "bg-green-600 border-green-600 text-white" 
                                    : "border-black/20 hover:border-black/50"
                                }`}
                              >
                                {task.completed && <Check size={12} strokeWidth={3} />}
                              </button>
                              <h3 className={`text-base font-bold ${task.completed ? "line-through text-black/40" : ""}`}>
                                {task.title}
                              </h3>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wide font-mono px-2 py-0.5 rounded ${
                                isHigh ? "bg-red-100 text-red-700" : isMed ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {task.priority}
                              </span>
                              <button 
                                onClick={() => deleteTask(task.id)}
                                className="p-1 hover:text-red-500 text-black/30 hover:bg-black/5 rounded-lg transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs opacity-70 mb-3 pl-7">
                            {task.description}
                          </p>

                          {task.consequence && (
                            <div className="pl-7 mb-4">
                              <div className="text-[10px] uppercase font-bold text-amber-800 font-mono tracking-wider mb-1">Consequence modeling</div>
                              <p className="text-xs italic bg-amber-50/50 border-l-2 border-amber-400 p-2 text-amber-950 rounded-r-lg">{task.consequence}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-4 pl-7">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {!task.completed ? (
                                <button 
                                  onClick={() => toggleTask(task.id, task.completed)}
                                  className="skeu-btn px-4 py-1.5 text-[11px] font-bold cursor-pointer"
                                >
                                  Complete Directive
                                </button>
                              ) : (
                                <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 size={14} /> Completed
                                </span>
                              )}

                              {task.actionType && task.actionType !== "general" && !task.completed && (
                                <button 
                                  onClick={() => setActiveActionTask(task)}
                                  className="skeu-btn px-4 py-1.5 text-[11px] font-bold cursor-pointer flex items-center gap-1.5 bg-[#D97706]/10 text-[#B45309] border-[#D97706]/30 hover:bg-[#D97706]/20 transition-all shadow-sm"
                                >
                                  <Sparkles size={11} className="animate-pulse" />
                                  <span>
                                    {task.actionType === "pay_bill" 
                                      ? `Pay ${task.payee || "Bill"} ($${task.amount})`
                                      : task.actionType === "email_draft"
                                        ? "Draft Reply re: " + (task.payee || "Query")
                                        : task.actionType === "prefilled_form"
                                          ? "Review Prefilled Form"
                                          : `Execute Portal`
                                    }
                                  </span>
                                </button>
                              )}

                              <div className="flex flex-col ml-2">
                                <span className="text-[9px] uppercase opacity-40 font-bold font-mono">Friction Score</span>
                                <div className="flex space-x-1 mt-0.5">
                                  {[1, 2, 3, 4, 5].map((dotIndex) => (
                                    <div 
                                      key={dotIndex}
                                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                        dotIndex <= task.friction ? "bg-[#4B5563]" : "bg-gray-200"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {task.category && (
                              <span className="text-[10px] font-mono opacity-50 bg-black/5 px-2 py-0.5 rounded">
                                {task.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: SETTINGS PANEL & PERSONALIZATION */}
          {activeTab === "settings" && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-2xl"
            >
              <div className="space-y-0.5 border-b border-black/5 pb-2">
                <h2 className="text-lg font-bold text-[#1A1A1A]">DIYA Node Personalization</h2>
                <p className="text-xs opacity-50">Fine-tune the cognitive sync and voice feedback profiles.</p>
              </div>

              <div className="skeu-card p-6 space-y-6">
                
                {/* Profile Settings */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black/60">Profile Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold block mb-1 opacity-70">Personalized Name</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newNameInput}
                          onChange={(e) => setNewNameInput(e.target.value)}
                          className="flex-1 bg-[#F9F7F2] border border-black/15 rounded-xl p-2.5 text-sm outline-none"
                        />
                        <button 
                          onClick={handleNameSave}
                          className="skeu-btn px-4 text-xs font-bold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1 opacity-70">Linked Email Address</label>
                      <input 
                        type="text"
                        disabled
                        value={user.email || ""}
                        className="w-full bg-black/[0.03] border border-black/10 text-black/50 rounded-xl p-2.5 text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Workspace OAuth Integrations */}
                <div className="space-y-3 border-t border-black/5 pt-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black/60">Automated Connections (OAuth)</h3>
                  <p className="text-[10px] opacity-50">Tether secure API access tokens for real-time synchronization and proactive AI action extraction.</p>
                  
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between p-3 bg-black/[0.02] border border-black/5 rounded-xl text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#1A1A1A]">Google Calendar Sync</p>
                        <p className="text-[10px] opacity-55">Fetch upcoming meetings, milestones and calendar blocks automatically.</p>
                      </div>
                      <button 
                        onClick={() => toggleConnectionNode("googleCalendar")}
                        className={`skeu-btn px-3 py-1.5 text-xs font-bold ${connections.googleCalendar ? "bg-green-50 text-green-700 border-green-300" : ""}`}
                      >
                        {connections.googleCalendar ? "Connected" : "Connect"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-black/[0.02] border border-black/5 rounded-xl text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#1A1A1A]">Gmail Crawler Feed</p>
                        <p className="text-[10px] opacity-55">Proactively scan incoming invoice subjects to build automated payment directives.</p>
                      </div>
                      <button 
                        onClick={() => toggleConnectionNode("gmail")}
                        className={`skeu-btn px-3 py-1.5 text-xs font-bold ${connections.gmail ? "bg-green-50 text-green-700 border-green-300" : ""}`}
                      >
                        {connections.gmail ? "Connected" : "Connect"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-black/[0.02] border border-black/5 rounded-xl text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#1A1A1A]">Google Tasks API</p>
                        <p className="text-[10px] opacity-55">Import priority tasks and check them off directly from DIYA Backlog.</p>
                      </div>
                      <button 
                        onClick={() => toggleConnectionNode("googleTasks")}
                        className={`skeu-btn px-3 py-1.5 text-xs font-bold ${connections.googleTasks ? "bg-green-50 text-green-700 border-green-300" : ""}`}
                      >
                        {connections.googleTasks ? "Connected" : "Connect"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-black/[0.02] border border-black/5 rounded-xl text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#1A1A1A]">Outlook & Office 365 Integration</p>
                        <p className="text-[10px] opacity-55">Synchronize enterprise calendar feeds and outlook meeting briefs.</p>
                      </div>
                      <button 
                        onClick={() => toggleConnectionNode("outlook")}
                        className={`skeu-btn px-3 py-1.5 text-xs font-bold ${connections.outlook ? "bg-green-50 text-green-700 border-green-300" : ""}`}
                      >
                        {connections.outlook ? "Connected" : "Connect"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Speech Synthesis Settings */}
                <div className="space-y-3 border-t border-black/5 pt-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black/60">Voice Assistance Options</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold">Speech Responses (TTS)</p>
                        <p className="text-[10px] opacity-50">Speak confirmation of newly compiled actions and timeline additions.</p>
                      </div>
                      <button 
                        onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                        className={`skeu-btn px-3 py-1.5 text-xs font-bold ${voiceOutputEnabled ? "bg-green-50 text-green-700" : ""}`}
                      >
                        {voiceOutputEnabled ? "Enabled" : "Muted"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Operations & Seeds Reset */}
                <div className="space-y-3 border-t border-black/5 pt-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black/60">Operational Reset & Recovery</h3>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { seedInitialTasks(); speakFeedback("Directives seeded."); }}
                      className="skeu-btn px-4 py-2 text-xs font-bold"
                    >
                      Seed Initial Directives
                    </button>
                    <button 
                      onClick={() => { seedInitialSchedules(); speakFeedback("Timeline blocks seeded."); }}
                      className="skeu-btn px-4 py-2 text-xs font-bold"
                    >
                      Seed Initial Schedules
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* METRICS TRACKER FOOTER */}
        <footer className="mt-auto pt-6 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 text-[10px] font-bold opacity-55 uppercase tracking-widest font-mono">
            <span>DIYA Life OS © 2026</span>
            <span className="opacity-30">•</span>
            <span>UID: {user.uid}</span>
          </div>
          <div className="text-[11px] cursive-title opacity-40 italic">
            Design for a life well lived.
          </div>
        </footer>
      </main>

      {/* DIYA SECURE ACTION PORTAL / SLIDING DRAWER MODAL */}
      <AnimatePresence>
        {activeActionTask && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isProcessingPayment) {
                  setActiveActionTask(null);
                  setPaymentSuccess(false);
                }
              }}
              className="fixed inset-0 bg-[#0F0F0D] backdrop-blur-sm z-50 cursor-pointer"
            />
            
            {/* Sliding Drawer Card */}
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-[#1C1C19] border-t border-amber-950/30 rounded-t-3xl p-6 sm:p-8 z-50 shadow-2xl text-[#F9F7F2] overflow-y-auto max-h-[90vh] space-y-6 font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-amber-900/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-[#1C1C19] font-bold shadow-md">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest font-mono text-amber-500">DIYA Secure Action Portal</h3>
                    <p className="text-[10px] opacity-50 font-mono">INTELLIGENT INTEGRATIVE GATEWAY v2.1</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    if (!isProcessingPayment) {
                      setActiveActionTask(null);
                      setPaymentSuccess(false);
                    }
                  }}
                  disabled={isProcessingPayment}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/55 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase opacity-55 font-bold tracking-wider text-amber-500/80">Active Directive</span>
                  <h4 className="text-lg font-bold tracking-tight">{activeActionTask.title}</h4>
                  <p className="text-xs opacity-75">{activeActionTask.description}</p>
                </div>

                {/* FLOW 1: BILL PAYMENT */}
                {activeActionTask.actionType === "pay_bill" && (
                  <div className="space-y-4 pt-2">
                    {/* Invoice detail cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-0.5">
                        <span className="text-[9px] uppercase font-mono opacity-50 block font-bold">Authorized Payee</span>
                        <span className="text-sm font-bold text-amber-100">{activeActionTask.payee || "Utility Provider"}</span>
                      </div>
                      <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-0.5">
                        <span className="text-[9px] uppercase font-mono opacity-50 block font-bold">Statement Balance</span>
                        <span className="text-sm font-mono font-bold text-amber-500">${activeActionTask.amount?.toFixed(2) || "0.00"}</span>
                      </div>
                    </div>

                    {/* Consequence alert */}
                    {activeActionTask.consequence && (
                      <div className="p-3.5 bg-amber-950/20 border-l-2 border-amber-500 text-amber-200/90 rounded-r-xl text-xs space-y-1">
                        <p className="font-bold uppercase font-mono text-[9px] tracking-wider">DIYA Cognitive Buffer Assessment</p>
                        <p className="italic">{activeActionTask.consequence}</p>
                      </div>
                    )}

                    {/* Payment Form / Interactive Wallet */}
                    {!paymentSuccess ? (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono uppercase opacity-50 block font-bold">Select Secure Source</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button 
                              onClick={() => setPaymentMethod("DIYA Secure Wallet")}
                              className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                                paymentMethod === "DIYA Secure Wallet" 
                                  ? "bg-amber-500/10 border-amber-500/50 text-[#F9F7F2]" 
                                  : "bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Wallet size={14} className="text-amber-500" />
                                <span>DIYA Direct Wallet</span>
                              </div>
                              <span className="text-[10px] font-mono opacity-50">$240.50</span>
                            </button>

                            <button 
                              onClick={() => setPaymentMethod("Simulated Visa **** 9428")}
                              className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                                paymentMethod === "Simulated Visa **** 9428" 
                                  ? "bg-amber-500/10 border-amber-500/50 text-[#F9F7F2]" 
                                  : "bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-amber-500 font-bold italic font-mono text-xs">V</span>
                                <span>Visa **** 9428</span>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Interactive Payment Switch / Gateway input URL override */}
                        {activeActionTask.actionUrl && (
                          <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                            <span className="opacity-60 text-[10px] font-mono">Original portal link:</span>
                            <a 
                              href={activeActionTask.actionUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-amber-500 underline hover:text-amber-400 flex items-center gap-1 font-mono text-[11px]"
                            >
                              <Link2 size={11} />
                              <span>{new URL(activeActionTask.actionUrl).hostname}</span>
                            </a>
                          </div>
                        )}

                        {/* Complete Payment CTA button */}
                        <button
                          onClick={async () => {
                            setIsProcessingPayment(true);
                            speakFeedback(`Processing ${activeActionTask.amount?.toFixed(2)} payment to ${activeActionTask.payee || "provider"}...`);
                            await new Promise(r => setTimeout(r, 1800));
                            setIsProcessingPayment(false);
                            setPaymentSuccess(true);
                            speakFeedback("Payment successful! Declaring active bill directive resolved.");
                            
                            // Mark task as complete!
                            await toggleTask(activeActionTask.id, activeActionTask.completed);
                            
                            // Decrease load index
                            setCognitiveLoadAfternoon(prev => Math.max(10, prev - 12));
                            
                            await new Promise(r => setTimeout(r, 1500));
                            setActiveActionTask(null);
                            setPaymentSuccess(false);
                          }}
                          disabled={isProcessingPayment}
                          className="w-full skeu-btn py-3.5 bg-amber-500 text-[#1C1C19] border-amber-600 font-extrabold uppercase tracking-wider text-xs hover:bg-amber-400 cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/10 disabled:opacity-50"
                        >
                          {isProcessingPayment ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Authorizing Proxy Node Payment...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={14} />
                              <span>Authorize Secure Payment of ${activeActionTask.amount?.toFixed(2)}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-green-950/10 border border-green-500/20 rounded-2xl animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold animate-bounce shadow-md">
                          <Check size={22} strokeWidth={3} />
                        </div>
                        <h4 className="text-base font-bold text-green-400">Payment Successfully Dispatched</h4>
                        <p className="text-xs opacity-75 max-w-sm">
                          DIYA has successfully processed the ${activeActionTask.amount?.toFixed(2)} statement payload to {activeActionTask.payee}. Backlog directive marked as completed.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* FLOW 2: EMAIL DRAFT REVIEW */}
                {activeActionTask.actionType === "email_draft" && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2 text-xs">
                        <span className="opacity-60">Recipient: <strong className="text-amber-100">{activeActionTask.payee || "Sarah Jenkins"}</strong></span>
                        <span className="text-[9px] uppercase font-mono bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded">Smart AI Draft</span>
                      </div>
                      
                      <textarea
                        disabled={paymentSuccess}
                        value={activeActionTask.content}
                        className="w-full bg-transparent text-xs text-white/95 leading-relaxed outline-none h-40 resize-none font-mono"
                        onChange={(e) => {
                          if (activeActionTask) {
                            setActiveActionTask({ ...activeActionTask, content: e.target.value });
                          }
                        }}
                      />
                    </div>

                    {!paymentSuccess ? (
                      <div className="space-y-2">
                        <button
                          onClick={async () => {
                            setIsProcessingPayment(true);
                            speakFeedback("Copying AI draft response to workspace clipboard and resolving...");
                            
                            // Simulated copy operation
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(activeActionTask.content || "");
                            }
                            
                            await new Promise(r => setTimeout(r, 1200));
                            setIsProcessingPayment(false);
                            setPaymentSuccess(true);
                            speakFeedback("Email template secured. Backlog element archived.");
                            
                            await toggleTask(activeActionTask.id, activeActionTask.completed);
                            setCognitiveLoadMorning(prev => Math.max(10, prev - 8));
                            
                            await new Promise(r => setTimeout(r, 1500));
                            setActiveActionTask(null);
                            setPaymentSuccess(false);
                          }}
                          disabled={isProcessingPayment}
                          className="w-full skeu-btn py-3.5 bg-amber-500 text-[#1C1C19] border-amber-600 font-extrabold uppercase tracking-wider text-xs hover:bg-amber-400 cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-55"
                        >
                          {isProcessingPayment ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Securing Email Payload...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Copy & Deploy AI Draft Response</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-green-950/10 border border-green-500/20 rounded-2xl animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold animate-bounce shadow-md">
                          <Check size={22} strokeWidth={3} />
                        </div>
                        <h4 className="text-base font-bold text-green-400">Draft Completed & Exported</h4>
                        <p className="text-xs opacity-75 max-w-sm">
                          The email draft payload is copied to your active system clipboard. DIYA has successfully archived this cognitive directive.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* FLOW 3: EXTERNAL PORTAL LINK / LINK */}
                {activeActionTask.actionType === "link" && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-center space-y-3 text-xs">
                      <Globe size={32} className="mx-auto text-amber-500 animate-pulse" />
                      <p className="opacity-85">
                        This action resolves via an external secure gateway portal. You can choose to launch the portal sandbox or complete it directly.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <a 
                        href={activeActionTask.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={async () => {
                          speakFeedback("Launching secure browser gateway.");
                          // Automatically toggle to completed in DIYA too to maintain high tactile response!
                          await toggleTask(activeActionTask.id, activeActionTask.completed);
                          setActiveActionTask(null);
                        }}
                        className="skeu-btn py-3 border border-amber-500/30 text-amber-500 font-bold uppercase tracking-wider text-xs hover:bg-white/5 flex items-center justify-center gap-2 text-center"
                      >
                        <Globe size={13} />
                        <span>Launch External Portal</span>
                      </a>

                      <button
                        onClick={async () => {
                          setIsProcessingPayment(true);
                          await new Promise(r => setTimeout(r, 1000));
                          setIsProcessingPayment(false);
                          await toggleTask(activeActionTask.id, activeActionTask.completed);
                          setActiveActionTask(null);
                          speakFeedback("Portal action completed.");
                        }}
                        className="skeu-btn py-3 bg-amber-500 text-[#1C1C19] border-amber-600 font-extrabold uppercase tracking-wider text-xs hover:bg-amber-400 flex items-center justify-center gap-2"
                      >
                        <Check size={13} strokeWidth={3} />
                        <span>Force Archive Directive</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
