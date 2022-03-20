import Spacer from "components/layout/Spacer.vue";
import { jsx } from "features/feature";
import { addEmitter } from "features/particles/particles";
import { globalBus } from "game/events";
import { createLayer, GenericLayer } from "game/layers";
import { persistent } from "game/persistence";
import player, { PlayerData } from "game/player";
import Decimal, { format, formatTime } from "util/bignum";
import { renderCol } from "util/vue";
import { computed, watch } from "vue";
import flowers from "./flowers/layer";
import { IParticlesOptions } from "tsparticles-engine";
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
                lastProc = Date.now();
                addEmitter(
                    {
                        // TODO this case is annoying but required because move.direction is a string rather than keyof MoveDirection
                        particles: confetti as unknown as IParticlesOptions,
                        autoPlay: true,
                        fill: false,
                        shape: "square",
                        startCount: 0,
                        life: {
                            count: 1,
                            duration: 0.1,
                            wait: false
                        },
                        rate: {
                            delay: 0,
                            quantity: 15
                        },
                        size: {
                            width: 0,
                            height: 0,
                            mode: "percent"
                        }
                    },
                    {
                        x: 50,
                        y: 50
                    }
                );
            }
        });
    });

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
