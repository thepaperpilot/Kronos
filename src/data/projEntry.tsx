import Spacer from "components/layout/Spacer.vue";
import { CoercableComponent, Visibility } from "features/feature";
import { jsx } from "features/feature";
import { createJob, GenericJob } from "features/job/job";
import { createParticles } from "features/particles/particles";
import { createResource, trackBest, trackTotal } from "features/resources/resource";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import type { BaseLayer, GenericLayer } from "game/layers";
import { addLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import type { LayerData, Player } from "game/player";
import player from "game/player";
import settings from "game/settings";
import Decimal, { format, formatTime, formatWhole } from "util/bignum";
import type { ArrayElements } from "util/common";
import { render, renderCol } from "util/vue";
import { computed, ComputedRef, ref, unref, watch, watchEffect } from "vue";
import { useToast } from "vue-toastification";
import breeding from "./breeding/breeding";
import confetti from "./confetti.json";
import Cutscene from "./Cutscene.vue";
import distill from "./distill/distill";
import experiments from "./experiments/experiments";
import flowers from "./flowers/flowers";
import generators from "./generators/generators";
import rituals from "./rituals/rituals";
import study from "./study/study";

interface Cutscene {
    pages: CutscenePage[];
    page: number;
    onFinished?: VoidFunction;
}

interface CutscenePage {
    stage: CoercableComponent;
    caption?: CoercableComponent;
}

const toast = useToast();

export const jobKeys = [
    "flowers",
    "distill",
    "study",
    "experiments",
    "generators",
    "breeding",
    "rituals"
] as const;
export type JobKeys = ArrayElements<typeof jobKeys>;

const id = "main";
/**
 * @hidden
 */
export const main = createLayer(id, function (this: BaseLayer) {
    const chapter = persistent<number>(0);

    const jobs = {
        flowers: flowers.job as GenericJob,
        distill: distill.job as GenericJob,
        study: study.job as GenericJob,
        experiments: experiments.job as GenericJob,
        generators: generators.job as GenericJob,
        breeding: breeding.job as GenericJob,
        rituals: rituals.job as GenericJob
    } as Record<JobKeys, GenericJob>;

    const timeSlots = computed(() => {
        let slots = 0;
        if (chapter.value > 1) {
            slots = 1;
            if (study.milestones.timeSlotMilestone.earned.value) {
                slots++;
            }
            if (experiments.milestones.timeSlotMilestone.earned.value) {
                slots++;
            }
            if (rituals.milestones.timeSlotMilestone.earned.value) {
                slots++;
            }
        }
        return slots;
    });
    const usedTimeSlots = computed(
        () =>
            Object.values(jobs).filter(j => j.timeLoopActive.value).length +
            generators.extraTimeSlotsAllocated.value
    ) as ComputedRef<number>;
    const hasTimeSlotAvailable = computed(() => timeSlots.value > usedTimeSlots.value);

    const resetTimes = persistent<number[]>([0, 0, 0, 0, 0]);

    Object.values(jobs).forEach(job => {
        let lastProc = 0;
        watch(job.rawLevel, (currLevel, prevLevel) => {
            if (settings.active !== player.id || Decimal.neq(currLevel, Decimal.add(prevLevel, 1)))
                return;
            if (job.notif != null) {
                toast.dismiss(job.notif);
            }
            job.notif = toast.info(`${job.name} is now level ${currLevel}!`);
            if (Date.now() - lastProc > 500) {
                const rect = main.nodes.value[job.id]?.rect;
                const boundingRect = particles.boundingRect.value;
                if (rect && boundingRect) {
                    lastProc = Date.now();
                    const config = Object.assign({}, confetti, {
                        behaviors: [
                            ...confetti.behaviors.slice(0, -1),
                            {
                                type: "spawnShape",
                                config: {
                                    type: "rect",
                                    data: {
                                        x: rect.x - boundingRect.x,
                                        y: rect.y - boundingRect.y,
                                        w: rect.width,
                                        h: rect.height
                                    }
                                }
                            }
                        ]
                    });
                    particles.addEmitter(config).then(e => e.playOnceAndDestroy());
                }
            }
        });
    });

    const sumJobLevels = createResource(
        computed(() =>
            Object.values(jobs).reduce((acc, curr) => acc.add(curr.level.value), new Decimal(0))
        ),
        "Sum of all job levels"
    );
    const totalJobLevelsSum = trackTotal(sumJobLevels);
    const bestJobLevelsSum = trackBest(sumJobLevels);

    const closeTimeLoop = createUpgrade(() => ({
        display: {
            title: "<h1>Close the time loop</h1>",
            description:
                "<br/><i>The flowers are collected, and I have just enough. It's time to get started.</i>"
        },
        canAfford: true,
        style: `width: 150px; height: 150px; --layer-color: ${flowers.color}`,
        visibility: () => chapter.value == 1 && Decimal.gte(flowers.flowers.value, 10000000)
    }));

    const particles = createParticles(() => ({
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        style: "z-index: -1"
    }));

    const activeCutscene = ref<null | Cutscene>(null);
    watchEffect(() => {
        if (settings.active !== player.id) return;
        if (chapter.value === 0) {
            activeCutscene.value = {
                pages: [
                    {
                        stage: jsx(() => (
                            <img
                                style="max-width: 100%; flex-grow: 1"
                                src="https://upload.wikimedia.org/wikipedia/commons/7/71/Serpiente_alquimica.jpg"
                            />
                        ))
                    },
                    {
                        stage: jsx(() => (
                            <img
                                style="max-width: 100%; flex-grow: 1"
                                src="https://dummyimage.com/720x320/000/fff.png"
                            />
                        )),
                        caption: "Test"
                    },
                    {
                        stage: jsx(() => (
                            <div style="display: flex">
                                <img
                                    style="max-width: 100%; flex-grow: 1; margin-right: -20%"
                                    src="https://dummyimage.com/386x320/000/fff.png"
                                />
                                <img
                                    style="max-width: 100%; flex-grow: 1; margin-left: -20%"
                                    src="https://dummyimage.com/386x320/000/fff.png"
                                />
                            </div>
                        )),
                        caption: "Other test"
                    }
                ],
                page: 0,
                onFinished() {
                    chapter.value = 1;
                    addLayer(flowers, player);
                }
            };
            return;
        } else if (chapter.value === 1 && closeTimeLoop.bought.value) {
            activeCutscene.value = {
                pages: [
                    {
                        stage: jsx(() => (
                            <img
                                style="max-width: 100%; flex-grow: 1"
                                src="https://dummyimage.com/720x320/000/fff.png"
                            />
                        )),
                        caption:
                            "I can wrap this field in a time loop and reset it whenever the field is empty. If I take the flowers out of the loop before hand I will have a perfectly sustainable source of moly."
                    },
                    {
                        stage: jsx(() => (
                            <img
                                style="max-width: 100%; flex-grow: 1"
                                src="https://dummyimage.com/720x320/000/fff.png"
                            />
                        )),
                        caption:
                            "Now my focus will be transforming the flowers, and determining how best to utilize their power. I'll start by distilling the flowers into their component elements."
                    }
                ],
                page: 0,
                onFinished() {
                    chapter.value = 2;
                    addLayer(distill, player);
                }
            };
            return;
        }
        activeCutscene.value = null;
    });

    const goalDisplay = computed(() => {
        if (chapter.value === 1) {
            return (
                <h2>
                    Current Goal: Harvest all the moly
                    <br />({formatWhole(
                        Decimal.sub(10000000, flowers.flowers.value).clampMin(0)
                    )}{" "}
                    remaining)
                </h2>
            );
        } else if (chapter.value == 2) {
            return <h2>Current Goal: Perform Ritual of Génesis</h2>;
        }
        return <></>;
    });

    const partialJob = createJob("???", () => ({
        color: "black",
        image: "https://dummyimage.com/720x320/000/fff.png",
        imageFocus: {
            x: "50%",
            y: "50%"
        },
        layerID: "unknown",
        symbol: "",
        loopable: false,
        visibility: () => {
            if (
                generators.milestones.jobMilestone.earned.value !==
                breeding.milestones.jobMilestone.earned.value
            ) {
                return Visibility.Visible;
            }
            return Visibility.None;
        },
        classes: { broken: true },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        open: () => {}
    }));

    return {
        name: "Jobs",
        chapter,
        timeSlots,
        hasTimeSlotAvailable,
        resetTimes,
        closeTimeLoop,
        activeCutscene,
        classes: { nigredo: true },
        jobs,
        partialJob,
        sumJobLevels,
        bestJobLevelsSum,
        totalJobLevelsSum,
        display: jsx(() =>
            activeCutscene.value ? (
                <Cutscene
                    stage={activeCutscene.value.pages[activeCutscene.value.page].stage}
                    caption={activeCutscene.value.pages[activeCutscene.value.page].caption}
                    onNext={() => {
                        if (activeCutscene.value) {
                            if (
                                activeCutscene.value.page ==
                                activeCutscene.value.pages.length - 1
                            ) {
                                activeCutscene.value.onFinished?.();
                            } else {
                                activeCutscene.value.page++;
                            }
                        }
                    }}
                />
            ) : (
                <>
                    {player.devSpeed === 0 ? <div>Game Paused</div> : null}
                    {player.devSpeed && player.devSpeed !== 1 ? (
                        <div>Dev Speed: {format(player.devSpeed)}x</div>
                    ) : null}
                    {player.offlineTime ? (
                        <div>Offline Time: {formatTime(player.offlineTime)}</div>
                    ) : null}
                    {player.devSpeed != null || player.offlineTime != null ? <Spacer /> : null}
                    {unref(goalDisplay)}
                    <Spacer />
                    {Decimal.gt(timeSlots.value, 0) ? (
                        <div>
                            {timeSlots.value - usedTimeSlots.value} Time Slot
                            {timeSlots.value - usedTimeSlots.value === 1 ? "" : "s"} Available
                        </div>
                    ) : null}
                    {renderCol(...Object.values(jobs), partialJob)}
                    {render(closeTimeLoop)}
                    {render(particles)}
                </>
            )
        )
    };
});

globalBus.on("update", diff => {
    if (main.chapter.value > -1 && main.activeCutscene.value != null) {
        main.resetTimes.value[main.chapter.value - 1] += diff;
    }
});

export const numJobs = computed(
    () =>
        jobKeys.filter(jobKey => unref(main.jobs[jobKey].visibility) === Visibility.Visible).length
);

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<PlayerData>
): Array<GenericLayer> => {
    const chapter = (player.layers?.main as LayerData<typeof main> | undefined)?.chapter ?? 0;
    if (chapter === 0) {
        return [main];
    } else if (chapter === 1) {
        return [main, flowers];
    } else if (chapter === 2) {
        const layers: GenericLayer[] = [main, flowers, distill];
        if (
            (player.layers?.distill as LayerData<typeof distill>)?.milestones?.studyMilestone
                ?.earned === true
        ) {
            layers.push(study);
        }
        if (
            (player.layers?.distill as LayerData<typeof distill>)?.milestones?.experimentsMilestone
                ?.earned === true
        ) {
            layers.push(experiments);
        }
        if (
            (player.layers?.experiments as LayerData<typeof experiments>)?.milestones?.jobMilestone
                ?.earned === true
        ) {
            layers.push(generators);
        }
        if (
            (player.layers?.study as LayerData<typeof study>)?.milestones?.jobMilestone?.earned ===
            true
        ) {
            layers.push(breeding);
        }
        if (
            (player.layers?.generators as LayerData<typeof generators>)?.milestones?.jobMilestone
                ?.earned === true &&
            (player.layers?.breeding as LayerData<typeof breeding>)?.milestones?.jobMilestone
                ?.earned === true
        ) {
            layers.push(rituals);
        }
        return layers;
    }
    throw `Chapter ${chapter} not supported`;
};

/**
 * A computed ref whose value is true whenever the game is over.
 */
export const hasWon = computed(() => {
    return false;
});

/**
 * Given a player save data object being loaded with a different version, update the save data object to match the structure of the current version.
 * @param oldVersion The version of the save being loaded in
 * @param player The save data being loaded in
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<Player>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
