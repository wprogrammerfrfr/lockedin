"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Dices, Flame, IceCreamCone, Snowflake } from "lucide-react";
import {
  RoomMeltTable,
  type RoomMeltMember,
} from "@/components/rooms/RoomMeltTable";
import { MeltScene } from "@/components/session/MeltScene";
import { MeltTimerChip } from "@/components/session/MeltTimerChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createMeltConfig,
  ICE_CONTAINERS,
  ICE_CREAM_CONTAINERS,
  ICE_CREAM_FLAVORS,
  ICE_CREAM_TOPPINGS,
  ICE_SHAPES,
  type IceCreamFlavorId,
  type IceCreamToppingId,
  type IceShapeId,
  type MeltConfig,
  type MeltKind,
} from "@/features/session/melt-catalog";
import {
  createVisualSeed,
  seededInt,
  seededUnit,
} from "@/features/session/melt-seed";
import { computeMeltProgress } from "@/features/session/melt-utils";
import { cn } from "@/lib/utils";

const DEMO_YOU_ID = "demo-you";
const DEMO_MELT_SECONDS = 25;
const MAX_TOPPINGS = 3;

type DemoPhase = "design" | "melting";

function OptionTile({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-left text-xs transition",
        selected
          ? "border-lime-400 bg-lime-50 text-lime-900"
          : "border-border bg-card text-foreground hover:border-border hover:bg-background",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function friendElapsed(config: MeltConfig, progress: number): number {
  return Math.round(config.meltDurationMs * progress);
}

const MAYA_CONFIG = createMeltConfig({
  kind: "iceCream",
  containerId: "sundae_glass",
  flavorId: "strawberry",
  toppings: ["whipped_cream", "cherry"],
  visualSeed: "welcome-maya",
  displayName: "Strawberry Sundae",
});

const ALEX_CONFIG = createMeltConfig({
  kind: "iceCream",
  containerId: "cone",
  flavorId: "chocolate",
  toppings: ["sprinkles"],
  visualSeed: "welcome-alex",
  displayName: "Chocolate Cone",
});

const SAM_CONFIG = createMeltConfig({
  kind: "ice",
  containerId: "glass_cup",
  iceShapeId: "classic_cube",
  visualSeed: "welcome-sam",
  displayName: "Classic Cube in Glass Cup",
});

const FRIEND_MEMBERS: RoomMeltMember[] = [
  {
    userId: "maya",
    username: "maya",
    displayName: "Maya",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: friendElapsed(MAYA_CONFIG, 0.08),
    meltConfig: MAYA_CONFIG,
    meltBoardX: 0.18,
    meltBoardZ: 0.15,
  },
  {
    userId: "alex",
    username: "alex",
    displayName: "Alex",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: friendElapsed(ALEX_CONFIG, 0.58),
    meltConfig: ALEX_CONFIG,
    meltBoardX: 0.5,
    meltBoardZ: 0.85,
  },
  {
    userId: "sam",
    username: "sam",
    displayName: "Sam",
    avatarPath: null,
    status: "LOCKED_IN",
    elapsedMs: friendElapsed(SAM_CONFIG, 0.82),
    meltConfig: SAM_CONFIG,
    meltBoardX: 0.82,
    meltBoardZ: 0.25,
  },
];

function meltAnimSpeedFor(config: MeltConfig): number {
  return config.meltDurationMs / (DEMO_MELT_SECONDS * 1000);
}

export function WelcomeMeltShowcase() {
  const [phase, setPhase] = useState<DemoPhase>("design");
  const [kind, setKind] = useState<MeltKind>("iceCream");
  const [containerId, setContainerId] = useState("cone");
  const [flavorId, setFlavorId] = useState<IceCreamFlavorId>("vanilla");
  const [iceShapeId, setIceShapeId] = useState<IceShapeId>("classic_cube");
  const [toppings, setToppings] = useState<IceCreamToppingId[]>(["sprinkles"]);
  const [visualSeed, setVisualSeed] = useState(() => createVisualSeed());
  const [popKey, setPopKey] = useState(0);

  const [activeConfig, setActiveConfig] = useState<MeltConfig | null>(null);
  const [meltStartedAt, setMeltStartedAt] = useState<number | null>(null);
  const [youBoardX, setYouBoardX] = useState(0.35);
  const [youBoardZ, setYouBoardZ] = useState(0.05);
  const [now, setNow] = useState(() => Date.now());

  const previewConfig = useMemo(
    () =>
      createMeltConfig({
        kind,
        containerId,
        flavorId,
        iceShapeId,
        toppings,
        visualSeed,
      }),
    [kind, containerId, flavorId, iceShapeId, toppings, visualSeed],
  );

  const sceneConfig = activeConfig ?? previewConfig;
  const meltMinutes = Math.round(sceneConfig.meltDurationMs / 60_000);
  const containers =
    kind === "iceCream" ? ICE_CREAM_CONTAINERS : ICE_CONTAINERS;
  const designing = phase === "design";
  const melting = phase === "melting";

  const demoElapsedMs =
    meltStartedAt != null ? Math.max(0, now - meltStartedAt) : 0;
  const animSpeed = activeConfig ? meltAnimSpeedFor(activeConfig) : 1;
  const meltProgress = activeConfig
    ? computeMeltProgress(demoElapsedMs, 0, activeConfig.meltDurationMs, animSpeed)
    : 0;
  const meltDone = melting && meltProgress >= 1;

  useEffect(() => {
    if (!melting || meltDone) return;
    const id = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(id);
  }, [melting, meltDone]);

  function bumpPop() {
    setPopKey((k) => k + 1);
  }

  function selectKind(next: MeltKind) {
    if (!designing) return;
    setKind(next);
    setContainerId(next === "iceCream" ? "cone" : "glass_cup");
    setToppings(next === "iceCream" ? ["sprinkles"] : []);
    bumpPop();
  }

  function toggleTopping(id: IceCreamToppingId) {
    if (!designing) return;
    setToppings((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TOPPINGS) return prev;
      return [...prev, id];
    });
    bumpPop();
  }

  function shuffle() {
    if (!designing) return;
    const seed = createVisualSeed();
    setVisualSeed(seed);
    const nextKind: MeltKind = seededUnit(seed, 1) < 0.55 ? "iceCream" : "ice";
    setKind(nextKind);
    if (nextKind === "iceCream") {
      const list = ICE_CREAM_CONTAINERS;
      const flavors = ICE_CREAM_FLAVORS;
      const tops = ICE_CREAM_TOPPINGS;
      setContainerId(list[seededInt(seed, 2, 0, list.length - 1)]!.id);
      setFlavorId(
        flavors[seededInt(seed, 3, 0, flavors.length - 1)]!.id as IceCreamFlavorId,
      );
      const count = seededInt(seed, 4, 0, MAX_TOPPINGS);
      const picked: IceCreamToppingId[] = [];
      let guard = 0;
      while (picked.length < count && guard < 20) {
        const id = tops[seededInt(seed, 10 + guard, 0, tops.length - 1)]!
          .id as IceCreamToppingId;
        if (!picked.includes(id)) picked.push(id);
        guard += 1;
      }
      setToppings(picked);
    } else {
      const list = ICE_CONTAINERS;
      const shapes = ICE_SHAPES;
      setContainerId(list[seededInt(seed, 2, 0, list.length - 1)]!.id);
      setIceShapeId(
        shapes[seededInt(seed, 3, 0, shapes.length - 1)]!.id as IceShapeId,
      );
      setToppings([]);
    }
    bumpPop();
  }

  function startMelt() {
    const config = previewConfig;
    const started = Date.now();
    setActiveConfig(config);
    setMeltStartedAt(started);
    setNow(started);
    setYouBoardX(0.35);
    setYouBoardZ(0.05);
    setPhase("melting");
  }

  function resetDemo() {
    setPhase("design");
    setActiveConfig(null);
    setMeltStartedAt(null);
    setVisualSeed(createVisualSeed());
    bumpPop();
  }

  const onBoardPosChange = useCallback((x: number, z: number) => {
    setYouBoardX(x);
    setYouBoardZ(z);
  }, []);

  const tableMembers: RoomMeltMember[] = useMemo(() => {
    if (!activeConfig || meltStartedAt == null) return FRIEND_MEMBERS;
    const you: RoomMeltMember = {
      userId: DEMO_YOU_ID,
      username: "you",
      displayName: "You",
      avatarPath: null,
      status: "LOCKED_IN",
      elapsedMs: 0,
      clockSyncedAt: meltStartedAt,
      meltConfig: activeConfig,
      meltAnimSpeed: animSpeed,
      meltBoardX: youBoardX,
      meltBoardZ: youBoardZ,
    };
    return [...FRIEND_MEMBERS, you];
  }, [activeConfig, meltStartedAt, animSpeed, youBoardX, youBoardZ]);

  return (
    <Card className="border-amber-200">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <IceCreamCone className="h-5 w-5 text-amber-600" />
          Melt It
        </CardTitle>
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-foreground">
            Design a dessert. Hit MELT IT. Watch the table.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Try the making board here — no account needed. In Rooms, everyone&apos;s
            dessert sits on one shared Melt Board while you lock in.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
          {/* Making board */}
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Making board
            </p>
            <div className="relative flex flex-col items-center justify-center overflow-visible rounded-2xl border border-border bg-background p-3 shadow-soft sm:p-4">
              {melting ? (
                <div className="absolute top-3 right-3 z-10">
                  <MeltTimerChip
                    elapsedMs={demoElapsedMs}
                    meltProgress={meltProgress}
                    meltDurationMs={activeConfig?.meltDurationMs}
                    showElapsed
                  />
                </div>
              ) : null}
              <div className="flex w-full min-h-0 max-h-[min(16rem,40dvh)] items-center justify-center overflow-visible sm:max-h-[min(18rem,42dvh)] lg:max-h-[min(22rem,48dvh)]">
                <MeltScene
                  config={sceneConfig}
                  progress={melting ? meltProgress : 0}
                  size="xl"
                  popKey={popKey}
                  animated={melting}
                  className="!h-full !w-full !max-h-full !max-w-full"
                />
              </div>
              <p className="mt-3 shrink-0 text-center text-sm font-medium text-foreground">
                {sceneConfig.displayName}
              </p>
              <p className="mt-0.5 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                {meltMinutes} min melt target
              </p>
            </div>

            {designing ? (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-card text-foreground hover:bg-background"
                    onClick={shuffle}
                  >
                    <Dices className="mr-1.5 h-4 w-4" />
                    Shuffle
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "flex-1 border-border",
                      kind === "iceCream" &&
                        "border-lime-400 bg-lime-50 text-lime-900",
                    )}
                    onClick={() => selectKind("iceCream")}
                  >
                    <Flame className="mr-1 h-4 w-4" />
                    Ice cream
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "flex-1 border-border",
                      kind === "ice" && "border-sky-400 bg-sky-50 text-sky-900",
                    )}
                    onClick={() => selectKind("ice")}
                  >
                    <Snowflake className="mr-1 h-4 w-4" />
                    Ice
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Container
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {containers.map((c) => (
                      <OptionTile
                        key={c.id}
                        selected={containerId === c.id}
                        onClick={() => {
                          setContainerId(c.id);
                          bumpPop();
                        }}
                      >
                        {c.label}
                      </OptionTile>
                    ))}
                  </div>
                </div>

                {kind === "iceCream" ? (
                  <>
                    <div>
                      <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                        Flavor
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ICE_CREAM_FLAVORS.map((f) => (
                          <OptionTile
                            key={f.id}
                            selected={flavorId === f.id}
                            onClick={() => {
                              setFlavorId(f.id as IceCreamFlavorId);
                              bumpPop();
                            }}
                          >
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: f.color }}
                            />
                            {f.label}
                          </OptionTile>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 flex items-center justify-between text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                        <span>Toppings</span>
                        <span className="normal-case tracking-normal">
                          {toppings.length}/{MAX_TOPPINGS}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ICE_CREAM_TOPPINGS.map((top) => {
                          const selected = toppings.includes(
                            top.id as IceCreamToppingId,
                          );
                          const atCap =
                            !selected && toppings.length >= MAX_TOPPINGS;
                          return (
                            <OptionTile
                              key={top.id}
                              selected={selected}
                              className={cn(
                                "rounded-full px-3 py-1",
                                atCap && "cursor-not-allowed opacity-40",
                              )}
                              onClick={() => {
                                if (atCap) return;
                                toggleTopping(top.id as IceCreamToppingId);
                              }}
                            >
                              {top.label}
                            </OptionTile>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      Ice shape
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {ICE_SHAPES.map((s) => (
                        <OptionTile
                          key={s.id}
                          selected={iceShapeId === s.id}
                          onClick={() => {
                            setIceShapeId(s.id as IceShapeId);
                            bumpPop();
                          }}
                        >
                          {s.label}
                        </OptionTile>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full border border-lime-400/40 bg-lime-400 py-6 text-lg font-bold tracking-wide text-slate-950 hover:bg-lime-300"
                  onClick={startMelt}
                >
                  <IceCreamCone className="mr-2 h-5 w-5" />
                  MELT IT
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {meltDone
                    ? "Fully melted. Try another dessert, or drag yours on the table."
                    : "Your dessert is melting on the board and the shared table. Drag it to move."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!meltDone ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-300 text-rose-700 hover:bg-rose-50"
                      onClick={resetDemo}
                    >
                      TAP OUT
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="border border-lime-400/40 bg-lime-400 font-bold text-slate-950 hover:bg-lime-300"
                    onClick={resetDemo}
                  >
                    Try another
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Shared Melt Board */}
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Shared Melt Board
            </p>
            <div className="flex min-h-[14rem] flex-1 flex-col justify-end overflow-visible rounded-2xl border border-border bg-background p-3 shadow-soft sm:min-h-[16rem] sm:p-4">
              <RoomMeltTable
                members={tableMembers}
                selfUserId={melting ? DEMO_YOU_ID : null}
                onBoardPosChange={melting ? onBoardPosChange : undefined}
                className="min-h-[12rem] sm:min-h-[14rem]"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {melting
                ? "Friends stay put. Yours melts live — drag to rearrange."
                : "Friends are already melting. Design yours, then MELT IT."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
