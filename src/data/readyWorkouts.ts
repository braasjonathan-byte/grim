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
        name: "Push A – Bänk & Axlar",
        details: "Bänkpress 4×8\nAxelpress 3×10\nIncline hantlar 3×10\nTriceps pushdown 3×12\nSidolyft 3×15",
        tempo: "",
      },
      {
        name: "Push B – Incline fokus",
        details: "Incline bänkpress 4×8\nStående axelpress 3×10\nFlyes med hantlar 3×12\nÖverhead triceps 3×12\nFront raise 3×15",
        tempo: "",
      },
      {
        name: "Pull A – Bredd",
        details: "Chins 4×8\nLatsdrag 3×10\nFace pulls 3×15\nBicepscurl 3×12\nHammarcurl 3×12",
        tempo: "",
      },
      {
        name: "Pull B – Tjocklek",
        details: "Rodd med skivstång 4×8\nEnarms hantlarrodd 3×10\nKabeldrag bakom 3×12\nPreacher curl 3×12\nReverse flyes 3×15",
        tempo: "",
      },
      {
        name: "Axlar & Armar",
        details: "Axelpress 4×8\nSidolyft 3×15\nFace pulls 3×15\nBicepscurl 3×12\nTriceps pushdown 3×12\nSkallkross 3×10",
        tempo: "",
      },
      {
        name: "Bröst & Triceps",
        details: "Bänkpress 4×6\nIncline hantlar 3×10\nKabelflyes 3×12\nDipps 3×10\nTriceps pushdown 3×15\nDiamond pushups 2×max",
        tempo: "",
      },
      {
        name: "Rygg & Biceps",
        details: "Marklyft 3×5\nChins 3×8\nT-bar rodd 3×10\nKabelrodd sittande 3×12\nBicepscurl 3×12\nHammarcurl 3×10",
        tempo: "",
      },
      {
        name: "Push C – Volym",
        details: "Bänkpress 3×12\nAxelpress med hantlar 3×12\nIncline flyes 3×15\nLateral raise 4×15\nTriceps dips 3×12\nPushups 2×max",
        tempo: "",
      },
      {
        name: "Pull C – Volym",
        details: "Latsdrag brett grepp 3×12\nKabelrodd 3×12\nReverse flyes 3×15\nFace pulls 3×15\nConcentration curl 3×12\nHammarcurl rep 3×10",
        tempo: "",
      },
      {
        name: "Överkropp – Superset",
        details: "Bänkpress + Rodd 4×8\nAxelpress + Chins 3×10\nFlyes + Face pulls 3×12\nBicepscurl + Triceps pushdown 3×12\nSidolyft + Reverse flyes 3×15",
        tempo: "",
      },
    ],
  },
  {
    label: "Styrka – Underkropp",
    emoji: "🦵",
    workouts: [
      {
        name: "Benpass – Tung styrka",
        details: "Knäböj 4×6\nRumänsk marklyft 3×8\nBenpress 3×10\nUtfallssteg 3×10/ben\nVadpress 4×15",
        tempo: "",
      },
      {
        name: "Benpass – Volym",
        details: "Frontböj 3×10\nBulgarska utfall 3×10/ben\nBencurl 3×12\nHip thrust 3×12\nVadpress 3×15\nHängande benlyft 3×10",
        tempo: "",
      },
      {
        name: "Quad-fokus",
        details: "Knäböj 4×8\nBenpress fötter lågt 3×10\nBenspark 3×12\nSissy squats 3×12\nWalking lunges 3×12/ben\nVadpress 3×15",
        tempo: "",
      },
      {
        name: "Hamstrings & Glutes",
        details: "Rumänsk marklyft 4×8\nHip thrust 4×10\nBencurl 3×12\nGlute bridge enbens 3×12/ben\nGood mornings 3×10\nVadpress 3×15",
        tempo: "",
      },
      {
        name: "Underkropp – Unilateral",
        details: "Bulgarska utfall 4×8/ben\nEnbens benpress 3×10/ben\nEnbens marklyft 3×10/ben\nStep-ups 3×10/ben\nEnbens vadpress 3×12/ben",
        tempo: "",
      },
      {
        name: "Benpass – Explosiv",
        details: "Box squats 4×5\nJump squats 3×8\nPower cleans 3×5\nBenpress 3×10\nBox jumps 3×8\nVadpress 4×12",
        tempo: "",
      },
      {
        name: "Benpass – Superset",
        details: "Knäböj + Jump squats 4×8+6\nRumänsk marklyft + Benböj 3×10+12\nBenpress + Vadpress 3×10+15\nUtfallssteg + Glute bridge 3×10+12",
        tempo: "",
      },
      {
        name: "Marklyft-fokus",
        details: "Marklyft konventionell 5×5\nRumänsk marklyft 3×8\nGood mornings 3×10\nBencurl 3×12\nRyggextension 3×15\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Höft & Glutes",
        details: "Hip thrust 4×10\nSumo marklyft 3×8\nCable pull-through 3×12\nFrog pumps 3×20\nClamshells 3×15/sida\nFire hydrants 3×15/sida",
        tempo: "",
      },
      {
        name: "Benpass – Uthållighet",
        details: "Goblet squats 3×15\nWalking lunges 3×15/ben\nBenpress 3×15\nBencurl 3×15\nVadpress 3×20\nWall sit 3×45s",
        tempo: "",
      },
    ],
  },
  {
    label: "Helkropp",
    emoji: "🏋️",
    workouts: [
      {
        name: "Helkropp A – Styrka",
        details: "Knäböj 3×8\nBänkpress 3×8\nRodd 3×10\nAxelpress 3×10\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Helkropp B – Styrka",
        details: "Marklyft 3×5\nAxelpress 3×8\nChins 3×8\nUtfallssteg 3×10/ben\nBicepscurl 2×12",
        tempo: "",
      },
      {
        name: "Helkropp C – Volym",
        details: "Frontböj 3×10\nIncline hantlar 3×12\nKabelrodd 3×12\nSidolyft 3×15\nBencurl 3×12\nTriceps pushdown 3×12",
        tempo: "",
      },
      {
        name: "Helkropp D – Superset",
        details: "Knäböj + Axelpress 3×10\nBänkpress + Rodd 3×10\nUtfallssteg + Bicepscurl 3×10\nHip thrust + Face pulls 3×12\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Helkropp – Minimal utrustning",
        details: "Goblet squats 3×12\nPushups 3×15\nInverterade rodd 3×10\nLunges 3×10/ben\nPlanka 3×45s\nBurpees 3×8",
        tempo: "",
      },
      {
        name: "Helkropp – Nybörjare",
        details: "Benpress 3×10\nBänkpress maskin 3×10\nLatsdrag 3×10\nSidolyft 3×12\nBencurl 3×12\nVadpress 3×15",
        tempo: "",
      },
      {
        name: "Helkropp – Tung dag",
        details: "Knäböj 5×5\nBänkpress 5×5\nMarklyft 3×5\nChins 3×max\nPlanka 3×60s",
        tempo: "",
      },
      {
        name: "Helkropp – Lätt dag",
        details: "Goblet squats 3×12\nIncline hantlar 3×12\nKabelrodd 3×12\nSidolyft 3×15\nBicepscurl 2×15\nTriceps pushdown 2×15",
        tempo: "",
      },
      {
        name: "Helkropp – Push/Pull",
        details: "Bänkpress 3×8\nRodd 3×8\nAxelpress 3×10\nChins 3×10\nKnäböj 3×10\nRumänsk marklyft 3×10",
        tempo: "",
      },
      {
        name: "Helkropp – Komplex",
        details: "Power clean + Axelpress 4×5\nFrontböj 3×8\nPendlay rodd 3×8\nDipps 3×10\nHängande benlyft 3×10\nFarmers walk 3×30s",
        tempo: "",
      },
    ],
  },
  {
    label: "HIIT & Cirkelträning",
    emoji: "🔥",
    workouts: [
      {
        name: "HIIT – Klassisk 20 min",
        details: "4 rundor: 30s arbete / 15s vila\nBurpees\nMountain climbers\nJump squats\nHigh knees\nVila 60s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "Cirkelträning – Helkropp",
        details: "4 rundor: 40s arbete / 20s vila\nKettlebell swings\nBox jumps\nMedicinbollskast\nPlanka\nVila 90s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "Tabata – Burpees",
        details: "8 rundor: 20s arbete / 10s vila\nBurpees",
        tempo: "Max intensitet",
      },
      {
        name: "HIIT – Underkropp",
        details: "5 rundor: 30s arbete / 15s vila\nJump squats\nWalking lunges\nBox jumps\nGlute bridges\nVila 60s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "HIIT – Överkropp",
        details: "4 rundor: 30s arbete / 15s vila\nPushups\nMountain climbers\nBurpees\nPlank shoulder taps\nTriceps dips\nVila 60s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "EMOM – 15 min",
        details: "15 rundor: 60s arbete / 0s vila\nUdda min: 10 Kettlebell swings\nJämn min: 8 Burpees\n(Vila resten av minuten)",
        tempo: "Hög intensitet",
      },
      {
        name: "Cirkel – Styrka & Kondition",
        details: "3 rundor: 45s arbete / 15s vila\nThrusters\nRodd med hantlar\nBox jumps\nPushups\nKettlebell swings\nBurpees\nVila 90s mellan rundor",
        tempo: "Hög intensitet",
      },
      {
        name: "Tabata – Mix 16 min",
        details: "4 rundor: 20s arbete / 10s vila\nJump squats\nMountain climbers\nBurpees\nHigh knees\nVila 60s mellan rundor",
        tempo: "Max intensitet",
      },
      {
        name: "AMRAP – 12 min",
        details: "Så många rundor som möjligt på 12 min:\n5 Burpees\n10 Pushups\n15 Air squats\n20 Mountain climbers",
        tempo: "Hög intensitet",
      },
      {
        name: "Pyramid – Intervaller",
        details: "1 runda: 30s arbete / 15s vila\nBurpees 30s\nVila 15s\nBurpees 45s\nVila 15s\nBurpees 60s\nVila 30s\nBurpees 45s\nVila 15s\nBurpees 30s",
        tempo: "Max intensitet",
      },
    ],
  },
  {
    label: "Core & Bål",
    emoji: "🧱",
    workouts: [
      {
        name: "Core – Bas 15 min",
        details: "Planka 3×45s\nSidoplanka 3×30s/sida\nCrunches 3×20\nCykelcrunches 3×16\nHängande benlyft 3×10\nSuperman hold 3×30s",
        tempo: "",
      },
      {
        name: "Core – Antirotation",
        details: "Pallof press 3×12/sida\nSuitcase carry 3×30s/sida\nSidoplanka med rotation 3×10/sida\nDead bug 3×10/sida\nBird dog 3×10/sida\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Core – Hängande",
        details: "Hängande benlyft 4×10\nHängande knälyft 3×12\nHängande vridning 3×10/sida\nToes to bar 3×8\nPlanka 3×45s",
        tempo: "",
      },
      {
        name: "Core – Stabilitet",
        details: "Stir the pot (boll) 3×10/sida\nTRX fallouts 3×10\nAb wheel rollouts 3×10\nFarmers walk 3×30s\nBottoms-up KB carry 3×20s/sida\nPlanka 3×60s",
        tempo: "",
      },
      {
        name: "Core – Dynamisk",
        details: "Russian twists 3×20\nV-ups 3×15\nBicycle crunches 3×20\nFlutter kicks 3×30s\nScissors 3×20\nMountain climbers 3×30s",
        tempo: "",
      },
      {
        name: "Core – Tabata",
        details: "8 rundor: 20s arbete / 10s vila\nPlanka\nMountain climbers\nCrunches\nSidoplanka höger\nFlutter kicks\nSidoplanka vänster\nCykelcrunches\nDead bug",
        tempo: "Max intensitet",
      },
      {
        name: "Core – Nybörjare",
        details: "Dead bug 3×8/sida\nBird dog 3×8/sida\nPlanka 3×20s\nGlute bridge 3×12\nPelvic tilts 3×15\nModifierade crunches 3×12",
        tempo: "",
      },
      {
        name: "Core – Nedre mage",
        details: "Hängande benlyft 3×10\nReverse crunches 3×15\nLeg raises 3×12\nFlutter kicks 3×30s\nDead bug 3×10/sida\nHollow body hold 3×30s",
        tempo: "",
      },
      {
        name: "Core – Sneda bukmuskler",
        details: "Woodchops kabel 3×12/sida\nRussian twists 3×20\nSidoplanka höftlyft 3×10/sida\nPallof press 3×10/sida\nBicycle crunches 3×20\nSide bends 3×12/sida",
        tempo: "",
      },
      {
        name: "Core – Avancerad",
        details: "Dragon flags 3×6\nAb wheel standing 3×8\nL-sit hold 3×20s\nHängande toes to bar 3×10\nHuman flag progression 3×15s/sida\nFront lever hold 3×15s",
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
      {
        name: "Fartlek 30 min",
        details: "Uppvärmning — 5 min\nFartlek — 20 min (variera tempo efter känsla)\nNedvarvning — 5 min",
        tempo: "Varierat",
      },
      {
        name: "Löpning – Tempo 20 min",
        details: "Uppvärmning — 10 min\nTempo-löpning — 20 min (kontrollerat snabbt)\nNedvarvning — 10 min",
        tempo: "Zon 3-4",
      },
      {
        name: "Intervaller – Kort & Snabbt",
        details: "Uppvärmning — 10 min\n10×200m sprint (60s joggvila)\nNedvarvning — 10 min",
        tempo: "Max",
      },
      {
        name: "Långpass 60 min",
        details: "Löpning — 60 min",
        tempo: "Zon 2",
      },
      {
        name: "Cykel – Uthållighet 45 min",
        details: "Cykling — 45 min",
        tempo: "Zon 2-3",
      },
      {
        name: "Trappintervaller",
        details: "Uppvärmning — 5 min\n8×trappor upp (jogg ner som vila)\nNedvarvning — 5 min",
        tempo: "Hög intensitet",
      },
      {
        name: "Power Walk – Backar",
        details: "Promenad med backar — 40 min\nFokus på uppförsbackar i raskt tempo",
        tempo: "Medel-hög",
      },
    ],
  },
  {
    label: "Rörlighet & Yoga",
    emoji: "🧘",
    workouts: [
      {
        name: "Stretching – Helkropp 15 min",
        details: "Hamstrings stretch 2×45s/ben\nHöftböjare stretch 2×45s/ben\nBröstöppnare 2×30s\nKvadriceps stretch 2×30s/ben\nRygg/thoracal rotation 2×30s/sida",
        tempo: "",
      },
      {
        name: "Yoga – Morgonflöde",
        details: "Katt-ko 2×60s\nSolhälsning 5 rundor\nKrigare I 3×30s/sida\nKrigare II 3×30s/sida\nSavasana 3 min",
        tempo: "20 min",
      },
      {
        name: "Stretching – Underkropp",
        details: "Höftböjare stretch 2×60s/sida\nHamstrings stretch 2×60s/ben\nPiriformis stretch 2×45s/sida\nVadstretch 2×30s/ben\nInneradduktorer 2×45s\nKvadriceps stretch 2×45s/ben",
        tempo: "",
      },
      {
        name: "Stretching – Överkropp",
        details: "Bröststretch i dörr 2×30s\nLats stretch 2×30s/sida\nNacke 2×20s/sida\nTriceps stretch 2×20s/arm\nSkulderrotation 2×30s/sida\nThoracal extension 2×30s",
        tempo: "",
      },
      {
        name: "Yoga – Kvällsrutin",
        details: "Barnets ställning 2×60s\nLiggande vridning 2×45s/sida\nBen-mot-väggen 2×60s\nHappy baby 2×45s\nSavasana 5 min",
        tempo: "15 min",
      },
      {
        name: "Foam Rolling – Helkropp",
        details: "Vader 2×45s/ben\nLår framsida 2×45s/ben\nLår baksida 2×45s/ben\nIT-band 2×45s/sida\nRygg (övre) 2×60s\nGlutes 2×45s/sida",
        tempo: "15 min",
      },
      {
        name: "Mobilitet – Höfter",
        details: "90/90 stretch 2×45s/sida\nHip circles 2×10/sida\nDeep squat hold 3×30s\nCossack squats 2×8/sida\nFrog stretch 2×45s\nPigeon pose 2×45s/sida",
        tempo: "",
      },
      {
        name: "Mobilitet – Axlar & T-spine",
        details: "Wall slides 2×10\nThread the needle 2×8/sida\nBand pull-aparts 2×15\nThoracal rotation 2×8/sida\nShoulder CARs 2×5/sida\nHang from bar 3×20s",
        tempo: "",
      },
      {
        name: "Aktiv återhämtning",
        details: "Lätt promenad — 10 min\nFoam rolling helkropp — 10 min\nStatisk stretching — 10 min\nDjupandning — 5 min",
        tempo: "35 min",
      },
      {
        name: "Yoga – Styrka & Balans",
        details: "Solhälsning 3 rundor\nKrigare III 3×20s/sida\nTrädet 3×30s/sida\nPlanka 2×30s\nChaturanga flow 5 reps\nStående framåtfällning 2×30s\nSavasana 3 min",
        tempo: "25 min",
      },
    ],
  },
];
