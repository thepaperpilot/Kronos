import Spacer from "components/layout/Spacer.vue";
import { CoercableComponent, jsx, showIf } from "features/feature";
import { createParticles } from "features/particles/particles";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { addLayer, createLayer, GenericLayer } from "game/layers";
import { persistent } from "game/persistence";
import player, { PlayerData } from "game/player";
import Decimal, { format, formatTime, formatWhole } from "util/bignum";
import { render, renderCol } from "util/vue";
import { computed, ref, unref, watch, watchEffect } from "vue";
import confetti from "./confetti.json";
import Cutscene from "./Cutscene.vue";
import distill from "./distill/distill";
import flowers from "./flowers/flowers";
import study from "./study/study";
import experiments from "./experiments/experiments";

interface Cutscene {
    pages: CutscenePage[];
    page: number;
    onFinished?: VoidFunction;
}

interface CutscenePage {
    stage: CoercableComponent;
    caption?: CoercableComponent;
}

const id = "main";
/**
 * @hidden
 */
export const main = createLayer(id, () => {
    const chapter = persistent<number>(0);

    const jobs = [flowers.job, distill.job, study.job, experiments.job];

    const timeSlots = computed(() => {
        let slots = 0;
        if (chapter.value > 1) {
            slots = 1;
        }
        return slots;
    });
    const usedTimeSlots = computed(() => jobs.filter(j => j.timeLoopActive.value).length);
    const hasTimeSlotAvailable = computed(() => timeSlots.value > usedTimeSlots.value);

    const resetTimes = persistent<number[]>([0, 0, 0, 0, 0]);

    jobs.forEach(job => {
        let lastProc = 0;
        watch(job.rawLevel, (currLevel, prevLevel) => {
            if (Decimal.neq(currLevel, prevLevel) && Date.now() - lastProc > 500) {
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

    const closeTimeLoop = createUpgrade(() => ({
        display: {
            title: "<h1>Close the time loop</h1>",
            description:
                "<br/><i>The flowers are collected, and I have just enough. It's time to get started.</i>"
        },
        canAfford: true,
        style: `width: 150px; height: 150px; --layer-color: ${flowers.color}`,
        visibility: () => showIf(chapter.value == 1 && Decimal.gte(flowers.flowers.value, 10000000))
    }));

    const particles = createParticles(() => ({
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        style: "z-index: -1"
    }));

    // Preload images
    [
        "https://upload.wikimedia.org/wikipedia/commons/7/71/Serpiente_alquimica.jpg",
        "https://dummyimage.com/720x320/000/fff.png"
    ].forEach(image => (new Image().src = image));

    const activeCutscene = ref<null | Cutscene>(null);
    watchEffect(() => {
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

    return {
        name: "Jobs",
        chapter,
        timeSlots,
        hasTimeSlotAvailable,
        resetTimes,
        closeTimeLoop,
        activeCutscene,
        classes: { nigredo: true },
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
                    {player.devSpeed != null ||
                    player.offlineTime != null ||
                    hasTimeSlotAvailable.value ? (
                        <Spacer />
                    ) : null}
                    {unref(goalDisplay)}
                    <Spacer />
                    {Decimal.gt(timeSlots.value, 0) ? (
                        <div>
                            {timeSlots.value - usedTimeSlots.value} Time Slot
                            {timeSlots.value - usedTimeSlots.value === 1 ? "" : "s"} Available
                        </div>
                    ) : null}
                    {renderCol(...jobs)}
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

export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<PlayerData>
): Array<GenericLayer> => {
    const chapter = player.layers?.main?.chapter ?? 0;
    if (chapter === 0) {
        return [main];
    } else if (chapter === 1) {
        return [main, flowers];
    } else if (chapter === 2) {
        const layers: GenericLayer[] = [main, flowers, distill];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((player.layers?.distill as any).milestones.studyMilestone.earned.value) {
            layers.push(study);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((player.layers?.distill as any).milestones.experimentsMilestone.earned.value) {
            layers.push(experiments);
        }
        return layers;
    }
    throw `Chapter ${chapter} not supported`;
};

export const hasWon = computed(() => {
    return false;
});

/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<PlayerData>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
