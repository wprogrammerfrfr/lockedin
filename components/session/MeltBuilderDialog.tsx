"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Dices, Flame, IceCreamCone, Snowflake } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MeltScene } from "@/components/session/MeltScene";
import {
  createMeltConfig,
  ICE_CONTAINERS,
  ICE_CREAM_CONTAINERS,
  ICE_CREAM_FLAVORS,
  ICE_CREAM_TOPPINGS,
  ICE_SHAPES,
  MELT_PRESETS,
  type IceCreamFlavorId,
  type IceCreamToppingId,
  type IceShapeId,
  type MeltConfig,
  type MeltKind,
  type MeltPresetId,
} from "@/features/session/melt-catalog";
import { createVisualSeed, seededInt, seededUnit } from "@/features/session/melt-seed";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

type MeltBuilderDialogProps = {
  open: boolean;
  onClose: () => void;
  onMeltIt: (config: MeltConfig) => void;
  variant?: "solo" | "room";
};

const MAX_TOPPINGS = 3;

function OptionTile({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-left text-xs transition",
        selected
          ? "border-lime-400 bg-lime-50 text-lime-900"
          : "border-border bg-card text-foreground hover:border-border hover:bg-background",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MeltBuilderDialog({
  open,
  onClose,
  onMeltIt,
  variant = "solo",
}: MeltBuilderDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MeltKind>("iceCream");
  const [presetId, setPresetId] = useState<MeltPresetId | null>(null);
  const [containerId, setContainerId] = useState("cone");
  const [flavorId, setFlavorId] = useState<IceCreamFlavorId>("vanilla");
  const [iceShapeId, setIceShapeId] = useState<IceShapeId>("classic_cube");
  const [toppings, setToppings] = useState<IceCreamToppingId[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [visualSeed, setVisualSeed] = useState(() => createVisualSeed());
  const [popKey, setPopKey] = useState(0);

  const previewConfig = useMemo(() => {
    if (presetId) {
      return createMeltConfig({
        kind: presetId === "ice_1L_60m" ? "ice" : "iceCream",
        presetId,
        visualSeed,
        displayName: displayName.trim() || undefined,
      });
    }
    return createMeltConfig({
      kind,
      containerId,
      flavorId,
      iceShapeId,
      toppings,
      visualSeed,
      displayName: displayName.trim() || undefined,
    });
  }, [
    presetId,
    kind,
    containerId,
    flavorId,
    iceShapeId,
    toppings,
    visualSeed,
    displayName,
  ]);

  function bumpPop() {
    setPopKey((k) => k + 1);
  }

  function selectKind(next: MeltKind) {
    setKind(next);
    setPresetId(null);
    setContainerId(next === "iceCream" ? "cone" : "glass_cup");
    setToppings([]);
    bumpPop();
  }

  function toggleTopping(id: IceCreamToppingId) {
    setPresetId(null);
    setToppings((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TOPPINGS) return prev;
      return [...prev, id];
    });
    bumpPop();
  }

  function shuffle() {
    const seed = createVisualSeed();
    setVisualSeed(seed);
    setPresetId(null);
    setDisplayName("");
    const nextKind: MeltKind = seededUnit(seed, 1) < 0.55 ? "iceCream" : "ice";
    setKind(nextKind);
    if (nextKind === "iceCream") {
      const containers = ICE_CREAM_CONTAINERS;
      const flavors = ICE_CREAM_FLAVORS;
      const tops = ICE_CREAM_TOPPINGS;
      setContainerId(containers[seededInt(seed, 2, 0, containers.length - 1)]!.id);
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
      const containers = ICE_CONTAINERS;
      const shapes = ICE_SHAPES;
      setContainerId(containers[seededInt(seed, 2, 0, containers.length - 1)]!.id);
      setIceShapeId(
        shapes[seededInt(seed, 3, 0, shapes.length - 1)]!.id as IceShapeId,
      );
      setToppings([]);
    }
    bumpPop();
  }

  const meltMinutes = Math.round(previewConfig.meltDurationMs / 60_000);
  const containers =
    kind === "iceCream" ? ICE_CREAM_CONTAINERS : ICE_CONTAINERS;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex max-h-[min(92dvh,920px)] flex-col gap-0 overflow-hidden border-border bg-card p-0 text-foreground sm:max-w-5xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="font-display text-xl text-foreground">
            {variant === "room"
              ? t("melt.builder.roomTitle")
              : t("melt.builder.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("melt.builder.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(280px,1.15fr)_minmax(280px,1fr)] lg:overflow-hidden">
          <div className="flex shrink-0 flex-col border-b border-border bg-card px-6 pt-4 pb-4 lg:min-h-0 lg:shrink lg:border-b-0 lg:border-r lg:border-border lg:pb-6">
            <p className="mb-3 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("melt.builder.makingBoard")}
            </p>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-visible rounded-2xl border border-border bg-background p-3 sm:p-4 shadow-soft">
              <div className="flex w-full min-h-0 max-h-[min(16rem,40dvh)] items-center justify-center overflow-visible sm:max-h-[min(20rem,45dvh)] lg:max-h-[min(26rem,50dvh)]">
                <MeltScene
                  config={previewConfig}
                  progress={0}
                  size="xl"
                  popKey={popKey}
                  animated={false}
                  className="!h-full !w-full !max-h-full !max-w-full"
                />
              </div>
              <p className="mt-3 shrink-0 text-center text-sm font-medium text-foreground">
                {previewConfig.displayName}
              </p>
              <p className="mt-0.5 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                {t("melt.builder.meltTarget", { minutes: meltMinutes })}
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col lg:overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-4 pb-4 lg:pb-6">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border bg-card text-foreground hover:bg-background"
                  onClick={shuffle}
                >
                  <Dices className="mr-1.5 h-4 w-4" />
                  {t("melt.builder.shuffle")}
                </Button>
              </div>

              <div>
                <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  {t("melt.builder.quickStart")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MELT_PRESETS.map((p) => (
                    <OptionTile
                      key={p.id}
                      selected={presetId === p.id}
                      onClick={() => {
                        setPresetId(p.id);
                        setKind(p.config.kind);
                        setVisualSeed(createVisualSeed());
                        bumpPop();
                      }}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-muted-foreground">
                        {t("melt.builder.presetMelt", {
                          minutes: Math.round(p.meltDurationMs / 60_000),
                        })}
                      </span>
                    </OptionTile>
                  ))}
                </div>
              </div>

              {presetId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-background"
                  onClick={() => setPresetId(null)}
                >
                  {t("melt.builder.customizePreset")}
                </Button>
              ) : null}

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
                  {t("melt.kind.iceCream")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 border-border",
                    kind === "ice" &&
                      "border-sky-400 bg-sky-50 text-sky-900",
                  )}
                  onClick={() => selectKind("ice")}
                >
                  <Snowflake className="mr-1 h-4 w-4" />
                  {t("melt.kind.ice")}
                </Button>
              </div>

              {!presetId && (
                <>
                  <div>
                    <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      {t("melt.builder.container")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {containers.map((c) => (
                        <OptionTile
                          key={c.id}
                          selected={containerId === c.id}
                          onClick={() => {
                            setPresetId(null);
                            setContainerId(c.id);
                            bumpPop();
                          }}
                        >
                          {t(`melt.catalog.container.${c.id}`)}
                        </OptionTile>
                      ))}
                    </div>
                  </div>

                  {kind === "iceCream" ? (
                    <>
                      <div>
                        <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          {t("melt.builder.flavor")}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {ICE_CREAM_FLAVORS.map((f) => (
                            <OptionTile
                              key={f.id}
                              selected={flavorId === f.id}
                              onClick={() => {
                                setPresetId(null);
                                setFlavorId(f.id as IceCreamFlavorId);
                                bumpPop();
                              }}
                            >
                              <span
                                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: f.color }}
                              />
                              {t(`melt.catalog.flavor.${f.id}`)}
                            </OptionTile>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 flex items-center justify-between text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          <span>{t("melt.builder.toppings")}</span>
                          <span className="normal-case tracking-normal">
                            {t("melt.builder.toppingCount", {
                              count: toppings.length,
                              max: MAX_TOPPINGS,
                            })}
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
                                {t(`melt.catalog.topping.${top.id}`)}
                              </OptionTile>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                        {t("melt.builder.iceShape")}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {ICE_SHAPES.map((s) => (
                          <OptionTile
                            key={s.id}
                            selected={iceShapeId === s.id}
                            onClick={() => {
                              setPresetId(null);
                              setIceShapeId(s.id as IceShapeId);
                              bumpPop();
                            }}
                          >
                            {t(`melt.catalog.iceShape.${s.id}`)}
                          </OptionTile>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label
                  htmlFor="melt-display-name"
                  className="mb-2 block text-[10px] tracking-[0.14em] text-muted-foreground uppercase"
                >
                  {t("melt.builder.nameOptional")}
                </label>
                <input
                  id="melt-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={previewConfig.displayName}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-lime-400 focus:outline-none"
                />
              </div>

              {/* Spacer so sticky footer doesn't cover the last field on mobile */}
              <div className="h-2 shrink-0 lg:hidden" aria-hidden />
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-card px-6 pt-3 pb-4 lg:static lg:border-t-0 lg:pt-0 lg:pb-6 lg:px-6">
              <Button
                size="lg"
                className="w-full border border-lime-400/40 bg-lime-400 py-6 text-lg font-bold tracking-wide text-slate-950 hover:bg-lime-300"
                onClick={() => {
                  onMeltIt(previewConfig);
                  onClose();
                }}
              >
                <IceCreamCone className="mr-2 h-5 w-5" />
                {t("melt.action.meltIt")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
