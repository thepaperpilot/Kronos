<template>
    <div
        v-if="isVisible(visibility)"
        class="battery-container feature dontMerge"
        :style="{
            visibility: isHidden(visibility) ? 'hidden' : undefined
        }"
    >
        <div>{{ format(unref(effect)) }}x {{ effectDescription }}</div>
        <br />
        <div class="battery" :style="{ borderColor: unref(color), width: `${width}px` }">
            <svg :style="{ height: `${feedAmount.value}%`, borderColor: unref(color) }">
                <defs>
                    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
                        <feDropShadow dx="0" dy="0" :stdDeviation="3"></feDropShadow>
                    </filter>
                </defs>
                <path
                    style="filter: url(#glow)"
                    :style="{ opacity: 3, strokeWidth: lineWidth }"
                    :d="`M${coords.map(coord => coord.x + ',' + coord.y).join(' L')}`"
                />
            </svg>
            <div class="charge-display">{{ format(charge.value) }}<br />energeia</div>
        </div>
        <Slider
            :max="100 - unref(sumFeedAmounts) + unref(feedAmount)"
            :modelValue="unref(feedAmount)"
            @update:model-value="value => setFeedAmount(value)"
        />
    </div>
</template>

<script setup lang="ts">
import Slider from "components/fields/Slider.vue";
import { isHidden, isVisible, Visibility } from "features/feature";
import type { DecimalSource } from "util/bignum";
import { format } from "util/bignum";
import type { ProcessedComputable } from "util/computed";
import type { Ref } from "vue";
import { ref, unref, watch } from "vue";

const props = defineProps<{
    charge: Ref<DecimalSource>;
    effect: ProcessedComputable<DecimalSource>;
    effectDescription: string;
    feedAmount: Ref<number>;
    color: ProcessedComputable<string>;
    sumFeedAmounts: Ref<number>;
    visibility: ProcessedComputable<Visibility>;
    setFeedAmount: (value: number) => void;
}>();

// animate electricity svg
const numberOfPoints = 20;
const lineWidth = 4;
const amplitude = 30;
const margin = 0;
const maxHeight = 100 - margin * 2;
const width = 100;

const coords = ref<{ x: number; y: number }[]>([]);
const stdDeviation = ref<number>(3);
let timeout: NodeJS.Timeout | null = null;

let animateElectricity = () => {
    const numPoints = Math.max(
        3,
        Math.floor((numberOfPoints * props.feedAmount.value) / maxHeight)
    );
    coords.value = new Array(numPoints).fill(1).map((_, i) => {
        let first = i === 0;
        let last = i === numPoints - 1;
        let y = ((props.feedAmount.value - margin * 2) / (numPoints - 1)) * i + margin;
        let x = first || last ? width / 2 : (width - amplitude) / 2 + Math.random() * amplitude;

        return { x, y };
    });
    stdDeviation.value = Math.random() * (5 - 2) + 2;

    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(animateElectricity, Math.random() * 200 + 100);
};

watch(() => props.feedAmount.value, animateElectricity, { immediate: true });
</script>

<style scoped>
.battery-container {
    border: none !important;
    --feature-foreground: var(--foreground);
}

.battery {
    height: 100px;
    border: solid 4px white;
    border-radius: var(--border-radius);
    position: relative;
}

.battery svg {
    width: 100px;
    border-top: solid 2px;
    background: rgba(1, 1, 1, 0.25);
    transition-duration: 0s;
    position: absolute;
    bottom: 0;
    left: 0;
}

.battery path {
    stroke: #88f;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
}

.battery #glow feDropShadow {
    flood-color: #b7daff;
}

.charge-display {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: small;
}
</style>
