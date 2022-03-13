import Toggle from "components/fields/Toggle.vue";
import Spacer from "components/layout/Spacer.vue";
import { jsx, setDefault } from "features/feature";
import { globalBus } from "game/events";
import { createLayer, GenericLayer } from "game/layers";
import { persistent } from "game/persistence";
import player, { PlayerData } from "game/player";
import settings, { registerSettingField } from "game/settings";
import { format, formatTime } from "util/bignum";
import { renderCol } from "util/vue";
import { computed } from "vue";
import flowers from "./layers/flowers";

/**
 * @hidden
 */
export const main = createLayer(() => {
    const chapter = persistent<number>(1);

    const timeSlots = computed(() => 0);
    const usedTimeSlots = computed(() => 0);
    const hasTimeSlotAvailable = computed(() => timeSlots.value > usedTimeSlots.value);

    const resetTimes = persistent<number[]>([0, 0, 0, 0, 0]);

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
                    {timeSlots.value - usedTimeSlots.value} Time Slots Available
                </div>
                <Spacer
                    v-show={
                        player.devSpeed != null ||
                        player.offlineTime != null ||
                        hasTimeSlotAvailable.value
                    }
                />
                {renderCol(flowers.job)}
            </>
        ))
    };
});

globalBus.on("update", diff => {
    main.resetTimes.value[main.chapter.value - 1] += diff;
});

declare module "game/settings" {
    interface Settings {
        showAdvancedEXPBars: boolean;
    }
}

globalBus.on("loadSettings", settings => {
    setDefault(settings, "showAdvancedEXPBars", false);
});

registerSettingField(
    jsx(() => (
        <Toggle
            title="Show Advanced XP Bars"
            onUpdate:modelValue={value => (settings.showAdvancedEXPBars = value)}
            modelValue={settings.showAdvancedEXPBars}
        />
    ))
);

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
