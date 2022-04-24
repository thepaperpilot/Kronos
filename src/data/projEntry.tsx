import Spacer from "components/layout/Spacer.vue";
import Cutscene from "./Cutscene.vue";
import { CoercableComponent, jsx } from "features/feature";
import { createParticles } from "features/particles/particles";
import { globalBus } from "game/events";
import { addLayer, createLayer, GenericLayer } from "game/layers";
import { persistent } from "game/persistence";
import player, { PlayerData } from "game/player";
import Decimal, { format, formatTime } from "util/bignum";
import { render, renderCol } from "util/vue";
import { computed, ref, watch, watchEffect } from "vue";
import flowers from "./flowers/layer";
import confetti from "./confetti.json";

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

    const timeSlots = computed(() => 0);
    const usedTimeSlots = computed(() => 0);
    const hasTimeSlotAvailable = computed(() => timeSlots.value > usedTimeSlots.value);

    const resetTimes = persistent<number[]>([0, 0, 0, 0, 0]);

    const jobs = [flowers.job];

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
        }
        activeCutscene.value = null;
    });

    return {
        name: "Jobs",
        chapter,
        timeSlots,
        hasTimeSlotAvailable,
        resetTimes,
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
                        <div>Dev Speed: {format(player.devSpeed || 0)}x</div>
                    ) : null}
                    {player.offlineTime != undefined ? (
                        <div>Offline Time: {formatTime(player.offlineTime || 0)}</div>
                    ) : null}
                    {hasTimeSlotAvailable.value ? (
                        <div>
                            {timeSlots.value - usedTimeSlots.value} Time Slot
                            {timeSlots.value - usedTimeSlots.value === 1 ? "" : "s"} Available
                        </div>
                    ) : null}
                    {player.devSpeed != null ||
                    player.offlineTime != null ||
                    hasTimeSlotAvailable.value ? (
                        <Spacer />
                    ) : null}
                    {renderCol(...jobs)}
                    {render(particles)}
                </>
            )
        )
    };
});

globalBus.on("update", diff => {
    main.resetTimes.value[main.chapter.value - 1] += diff;
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
