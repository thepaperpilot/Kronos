import Spacer from "components/layout/Spacer.vue";
import { jsx } from "features/feature";
import { createParticles } from "features/particles/particles";
import { globalBus } from "game/events";
import { createLayer, GenericLayer } from "game/layers";
import { persistent } from "game/persistence";
import player, { PlayerData } from "game/player";
import Decimal, { format, formatTime } from "util/bignum";
import { render, renderCol } from "util/vue";
import { computed, ref, watch } from "vue";
import flowers from "./flowers/layer";
import confetti from "./confetti.json";

/**
 * @hidden
 */
export const main = createLayer(() => {
    const chapter = persistent<number>(1);

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
                    console.log(rect, boundingRect);
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

    return {
        id: "main",
        name: "Jobs",
        chapter,
        timeSlots,
        hasTimeSlotAvailable,
        resetTimes,
        display: jsx(() => (
            <>
                <div v-show={player.devSpeed === 0}>Game Paused</div>
                <div v-show={player.devSpeed && player.devSpeed !== 1}>
                    Dev Speed: {format(player.devSpeed || 0)}x
                </div>
                <div v-show={player.offlineTime != undefined}>
                    Offline Time: {formatTime(player.offlineTime || 0)}
                </div>
                <div v-show={hasTimeSlotAvailable.value}>
                    {timeSlots.value - usedTimeSlots.value} Time Slot
                    {timeSlots.value - usedTimeSlots.value === 1 ? "" : "s"} Available
                </div>
                <Spacer
                    v-show={
                        player.devSpeed != null ||
                        player.offlineTime != null ||
                        hasTimeSlotAvailable.value
                    }
                />
                {renderCol(...jobs)}
                {render(particles)}
            </>
        ))
    };
});

globalBus.on("update", diff => {
    main.resetTimes.value[main.chapter.value - 1] += diff;
});

export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<PlayerData>
): Array<GenericLayer> => {
    const chapter = player.layers?.main?.chapter ?? 1;
    if (chapter === 1) {
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
