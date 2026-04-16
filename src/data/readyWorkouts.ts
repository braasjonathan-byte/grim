// Pre-made individual workouts that can be imported into empty plan days

export interface ReadyWorkout {
  name: string;
  details: string;
  tempo: string;
}

export interface ReadyWorkoutCategory {
  label: string;
  emoji: string;
  workouts: ReadyWorkout[];
}

export const readyWorkoutCategories: ReadyWorkoutCategory[] = [
  {
    label: "Styrka – Överkropp",
    emoji: "💪",
    workouts: [
      {
        name: "Push-pass",
        details: "Bänkpress 4×8\nAxelpress 3×10\nIncline hantlar 3×10\nTriceps pushdown 3×12\nSidolyft 3×15",
        tempo: "",
      },
      {
        name: "Pull-pass",
        details: "Chins 4×8\nRodd med hantlar 4×10\nFace pulls 3×15\nBicepscurl 3×12\nHammarcurl 3×12",
        tempo: "",
      },
      {
        name: "Axlar & Armar",
        details: "Axelpress 4×8\nSidolyft 3×15\nFace pulls 3×15\nBicepscurl 3×12\nTriceps pushdown 3×12\nSkallkross 3×10",
        tempo: "",
      },
    ],
  },
  {
    label: "Styrka – Underkropp",
    emoji: "🦵",
    workouts: [
      {
        name: "Benpass – Styrka",
        details: "Knäböj 4×6\nRumänsk marklyft 3×8\nBenpress 3×10\nUtfallssteg 3×10/ben\nVadpress 4×15",
        tempo: "",
      },
      {
        name: "Benpass – Volym",
        details: "Frontböj 3×10\nBulgarska utfall 3×10/ben\nBencurl 3×12\nHip thrust 3×12\nVadpress 3×15\nHängande benlyft 3×10",
        tempo: "",
      },
    ],
  },
  {
    label: "Helkropp",
    emoji: "🏋️",
    workouts: [
      {
        name: "Helkropp A",
        details: "Knäböj 3×8\nBänkpress 3×8\nRodd 3×10\nAxelpress 3×10\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Helkropp B",
        details: "Marklyft 3×5\nAxelpress 3×8\nChins 3×8\nUtfallssteg 3×10/ben\nBicepscurl 2×12",
        tempo: "",
      },
    ],
  },
  {
    label: "HIIT & Cirkelträning",
    emoji: "🔥",
    workouts: [
      {
        name: "HIIT – 20 min",
        details: "4 rundor: 30s arbete / 15s vila\nBurpees\nMountain climbers\nJump squats\nHigh knees\nVila 60s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "Cirkelträning – Helkropp",
        details: "4 cirklar:\nKettlebell swings 1×40s\nBox Jumps 1×40s\nMedicinbollskast 1×40s\nPlanka 1×40s\nVila 20s mellan övningar, 90s mellan cirklar",
        tempo: "Max intensitet",
      },
      {
        name: "Tabata – 4 min",
        details: "8 rundor: 20s arbete / 10s vila\nBurpees",
        tempo: "Max intensitet",
      },
    ],
  },
  {
    label: "Core & Bål",
    emoji: "🧱",
    workouts: [
      {
        name: "Core-pass 15 min",
        details: "Planka 3×45s\nSidoplanka 3×30s/sida\nCrunches 3×20\nCykelcrunches 3×16\nHängande benlyft 3×10\nSuperman hold 3×30s",
        tempo: "",
      },
    ],
  },
  {
    label: "Kondition",
    emoji: "🏃",
    workouts: [
      {
        name: "Lugn löpning 30 min",
        details: "Löpning — 30 min",
        tempo: "Zon 2",
      },
      {
        name: "Intervaller 4×4 min",
        details: "Uppvärmning — 10 min\n4×4 min i tröskeltempo (2 min joggvila)\nNedvarvning — 10 min",
        tempo: "",
      },
      {
        name: "Promenad 45 min",
        details: "Promenad — 45 min",
        tempo: "Lugnt",
      },
    ],
  },
  {
    label: "Rörlighet & Yoga",
    emoji: "🧘",
    workouts: [
      {
        name: "Stretching 15 min",
        details: "Hamstrings stretch 2×45s/ben\nHöftböjare stretch 2×45s/ben\nBröstöppnare 2×30s\nKvadriceps stretch 2×30s/ben\nRygg/thoracal rotation 2×30s/sida",
        tempo: "",
      },
      {
        name: "Yoga – Morgonflöde",
        details: "Katt-ko 2×60s\nSolhälsning 5 rundor\nKrigare I 3×30s/sida\nKrigare II 3×30s/sida\nSavasana 3 min",
        tempo: "20 min",
      },
    ],
  },
];
