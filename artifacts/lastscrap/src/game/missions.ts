export type MissionObjectiveType =
  | "escape"
  | "scavenge"
  | "eliminate"
  | "hold"
  | "escort"
  | "sabotage"
  | "defend";

export type MissionReward = {
  scrap: number;
  label: string;
};

export type Mission = {
  id: number;
  codename: string;
  title: string;
  flavorText: string;
  objectiveSummary: string;
  objectiveType: MissionObjectiveType;
  reward: MissionReward;
  // escape
  escapeTimeSecs?: number;
  // scavenge
  scavengeQuota?: number;
  scavengeTimeSecs?: number;
  // eliminate
  eliminateName?: string;
  // hold
  holdDurationSecs?: number;
  holdZoneRadius?: number;
  holdWaveCount?: number;
  // escort
  escortWaveCount?: number;
  // sabotage (always 3 spawners)
  // defend
  defendTargetWave?: number;
  // multi-wave missions — enemy count multiplier vs. normal
  enemyMul?: number;
};

export const MISSIONS: Mission[] = [
  {
    id: 0,
    codename: "OP: FIRST BLOOD",
    title: "ESCAPE",
    flavorText:
      "The sector fell faster than command predicted. Your evac point is two blocks east. Get there before the horde closes the corridor — or become part of it.",
    objectiveSummary:
      "Reach the extraction zone before the timer runs out. Zombies are already between you and the exit.",
    objectiveType: "escape",
    escapeTimeSecs: 60,
    reward: { scrap: 80, label: "ESCAPE BONUS" },
    enemyMul: 1.6,
  },
  {
    id: 1,
    codename: "OP: FIELD STRIP",
    title: "SCAVENGE",
    flavorText:
      "Intel says a supply depot sat abandoned for six months. It's crawling now, but the parts inside are worth the risk. Bag the quota and get out.",
    objectiveSummary:
      "Collect the scrap quota before the clock hits zero. No RIG to protect — just you, your gun, and the pile.",
    objectiveType: "scavenge",
    scavengeQuota: 200,
    scavengeTimeSecs: 150,
    reward: { scrap: 100, label: "HAUL BONUS" },
    enemyMul: 0.8,
  },
  {
    id: 2,
    codename: "OP: DECAPITATE",
    title: "ELIMINATE",
    flavorText:
      'The screaming thing calling itself "RANCOR" has been rallying the undead for three grid squares. Take it down and the horde loses its nerve. Maybe.',
    objectiveSummary:
      "Locate and eliminate the named target RANCOR. A boss-class hostile — heavily armoured, aggressive slam attacks.",
    objectiveType: "eliminate",
    eliminateName: "RANCOR",
    reward: { scrap: 120, label: "KILL BONUS" },
    enemyMul: 0.9,
  },
  {
    id: 3,
    codename: "OP: IRON GROUND",
    title: "HOLD",
    flavorText:
      "The relay station is the only comms uplink in forty kilometers. Hold the transmission zone for three full minutes while command pushes through the data burst.",
    objectiveSummary:
      "Stay inside the marked zone for the full duration. Leaving resets your hold progress. Survive two waves of escalating pressure.",
    objectiveType: "hold",
    holdDurationSecs: 180,
    holdZoneRadius: 140,
    holdWaveCount: 2,
    reward: { scrap: 130, label: "HOLD BONUS" },
    enemyMul: 1.0,
  },
  {
    id: 4,
    codename: "OP: SHEPHERD",
    title: "ESCORT",
    flavorText:
      "ECHO-9 is a civilian engineer, non-combatant, and currently barricaded inside a burnt-out server room. She holds the unlock code for the next sector. Keep her breathing.",
    objectiveSummary:
      "Keep the survivor ECHO-9 alive through two waves. She cannot fight — zombies will target her. Stay close.",
    objectiveType: "escort",
    escortWaveCount: 2,
    reward: { scrap: 140, label: "ESCORT BONUS" },
    enemyMul: 1.0,
  },
  {
    id: 5,
    codename: "OP: DEAD STOP",
    title: "SABOTAGE",
    flavorText:
      "Three biomass spawners have been seeding the district with fresh dead for 48 hours. Destroy them all and the flow dries up. Easier said than done while they're still running.",
    objectiveSummary:
      "Locate and destroy 3 spawner nodes. Approach each one and hold to overload it. Active spawners continuously emit hostiles.",
    objectiveType: "sabotage",
    reward: { scrap: 150, label: "DEMOLITION BONUS" },
    enemyMul: 1.1,
  },
  {
    id: 6,
    codename: "OP: LAST STAND",
    title: "DEFEND THE RIG",
    flavorText:
      "This is it, operator. The reactor is the last power source in the dead zone. Command is forty minutes out. Hold the line through five waves — take out the alpha creature on wave five and you end this.",
    objectiveSummary:
      "Survive 5 escalating waves and eliminate the alpha BEHEMOTH on wave 5. The RIG must not fall.",
    objectiveType: "defend",
    defendTargetWave: 5,
    reward: { scrap: 200, label: "CAMPAIGN COMPLETE BONUS" },
    enemyMul: 1.3,
  },
];

export function getMission(id: number): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
